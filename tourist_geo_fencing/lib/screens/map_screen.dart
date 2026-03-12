import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/automatic_idle_detector.dart';
import '../services/automatic_alert_processor.dart';
import '../services/automatic_monitoring_config.dart';
import '../services/automatic_global_context.dart';
import '../models/safety_alert.dart';
import '../services/current_user_service.dart';
import '../services/auth_service.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Completer<GoogleMapController> _controller = Completer();
  final Set<Polygon> _polygons = {};
  final Set<Marker> _markers = {};
  Position? _currentPosition;
  StreamSubscription<Position>? _positionStream;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  // Automatic idle monitoring components
  final AutomaticIdleDetector _idleDetector = AutomaticIdleDetector();
  final AutomaticAlertProcessor _alertProcessor = AutomaticAlertProcessor();

  // Idle monitoring state
  Timer? _locationUpdateTimer;
  Position? _lastIdleCheckPosition;
  DateTime? _idleStartTime;
  bool _isCurrentlyIdle = false;
  bool _isTestMode = true;
  String _currentUserId = 'map_user_001'; // Will be set from user context

  @override
  void initState() {
    super.initState();
    _initNotifications();
    _requestPermissions();
    _loadRestrictedZones();
    _startLocationTracking();
    _initializeAutomaticMonitoring();
    _loadCurrentUser();
  }

  Future<void> _loadCurrentUser() async {
    try {
      await CurrentUserService().loadFromAuth();
      setState(() {
        _currentUserId = CurrentUserService().uid ?? _currentUserId;
      });
    } catch (e) {
      _addDebugLog('⚠️ Failed to load current user: $e');
    }
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    _locationUpdateTimer?.cancel();
    _idleDetector.dispose();
    _alertProcessor.dispose();
    super.dispose();
  }

  /// Initialize automatic idle monitoring on map page mount
  Future<void> _initializeAutomaticMonitoring() async {
    try {
      _addDebugLog('🚀 Initializing automatic idle monitoring on map page');

      // Set global context for notifications
      AutomaticGlobalContext.setCurrentContext(context);

      // Load configuration
      _isTestMode = await AutomaticMonitoringConfig.isTestMode;
      _addDebugLog('📋 Loaded config - Test mode: $_isTestMode');

      // Start automatic location updates every minute
      _startAutomaticLocationUpdates();

      _addDebugLog('✅ Automatic idle monitoring initialized successfully');
    } catch (e) {
      _addDebugLog('❌ Failed to initialize automatic monitoring: $e');
    }
  }

  /// Start automatic location updates every minute
  void _startAutomaticLocationUpdates() {
    _locationUpdateTimer = Timer.periodic(const Duration(minutes: 1), (
      timer,
    ) async {
      await _performAutomaticLocationCheck();
    });

    // Perform initial check immediately
    _performAutomaticLocationCheck();
    _addDebugLog('⏰ Started automatic location updates every minute');
  }

  /// Add debug log with timestamp (now just prints to console)
  void _addDebugLog(String message) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    final logMessage = '[$timestamp] $message';
    print(logMessage);
  }

  /// Perform automatic location check for idle detection
  Future<void> _performAutomaticLocationCheck() async {
    try {
      // Get current position with high accuracy
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      _addDebugLog(
        '📍 Got location: ${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}',
      );

      // Check for idle status
      await _checkForIdleStatus(position);

      // Update current position for map
      setState(() {
        _currentPosition = position;
      });
    } catch (e) {
      _addDebugLog('❌ Location check failed: $e');
    }
  }

  /// Check if user is idle within GPS jitter threshold
  Future<void> _checkForIdleStatus(Position currentPosition) async {
    const double idleThreshold = 0.0045; // ~500m in degrees

    if (_lastIdleCheckPosition == null) {
      // First position - set as baseline
      _lastIdleCheckPosition = currentPosition;
      _idleStartTime = DateTime.now();
      _addDebugLog('🎯 Set initial position for idle tracking');
      return;
    }

    // Calculate distance from last position
    final double latDiff =
        (currentPosition.latitude - _lastIdleCheckPosition!.latitude).abs();
    final double lonDiff =
        (currentPosition.longitude - _lastIdleCheckPosition!.longitude).abs();
    final bool withinThreshold =
        latDiff <= idleThreshold && lonDiff <= idleThreshold;

    if (withinThreshold) {
      // User is still within idle threshold
      if (!_isCurrentlyIdle) {
        _isCurrentlyIdle = true;
        _idleStartTime = DateTime.now();
        _addDebugLog('🔄 User entered idle state');
      }

      // Check if idle duration exceeds threshold
      final idleDuration = DateTime.now().difference(_idleStartTime!);
      final requiredIdleTime = _isTestMode
          ? const Duration(minutes: 1)
          : const Duration(hours: 5);

      if (idleDuration >= requiredIdleTime) {
        _addDebugLog(
          '⚠️ Idle threshold reached! Duration: ${idleDuration.inMinutes}min',
        );
        await _triggerAutomaticIdleAlert(currentPosition, idleDuration);
      } else {
        _addDebugLog(
          '⏳ Idle for ${idleDuration.inSeconds}s/${_isTestMode ? "60s" : "${requiredIdleTime.inHours}hrs"}',
        );
      }
    } else {
      // User moved outside threshold - reset idle state
      if (_isCurrentlyIdle) {
        _addDebugLog('🚶 User moved - resetting idle state');
        _isCurrentlyIdle = false;
        _idleStartTime = null;
      }
      _lastIdleCheckPosition = currentPosition;
    }
  }

  /// Trigger automatic idle alert with database storage, Gemini API, and notifications
  Future<void> _triggerAutomaticIdleAlert(
    Position position,
    Duration idleDuration,
  ) async {
    try {
      _addDebugLog('🚨 Triggering automatic idle alert');

      // Create safety alert
      final alert = SafetyAlert(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        userId: _currentUserId,
        dtid: CurrentUserService().dtid ?? '',
        latitude: position.latitude,
        longitude: position.longitude,
        idleStartTimestamp: _idleStartTime!,
        idleDuration: idleDuration,
      );

      // Store in database immediately
      await _storeAlertInDatabase(alert);

      // Show immediate popup notification on map
      _showIdleAlertPopup(alert, idleDuration);

      // Send push notification
      await _sendAutomaticPushNotification(alert);

      // Enrich with Gemini API asynchronously (don't block)
      _enrichAlertWithGeminiAsync(alert);

      // Reset idle state to avoid duplicate alerts
      _isCurrentlyIdle = false;
      _idleStartTime = null;
      _lastIdleCheckPosition = position;

      _addDebugLog('✅ Idle alert processed successfully');
    } catch (e) {
      _addDebugLog('❌ Failed to process idle alert: $e');
    }
  }

  /// Store safety alert in Firestore database
  Future<void> _storeAlertInDatabase(SafetyAlert alert) async {
    try {
      await _firestore
          .collection('safety_alerts')
          .doc(alert.id)
          .set(alert.toFirestore());

      _addDebugLog('💾 Alert stored in database with ID: ${alert.id}');
    } catch (e) {
      _addDebugLog('❌ Database storage failed: $e');
      rethrow;
    }
  }

  /// Show immediate alert popup on the map page
  void _showIdleAlertPopup(SafetyAlert alert, Duration idleDuration) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(
                Icons.warning_amber_outlined,
                color: Colors.orange,
                size: 28,
              ),
              const SizedBox(width: 8),
              const Text('Idle Alert'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('You have been idle for ${idleDuration.inMinutes} minutes.'),
              const SizedBox(height: 8),
              Text(
                'Location: ${alert.latitude.toStringAsFixed(6)}, ${alert.longitude.toStringAsFixed(6)}',
              ),
              const SizedBox(height: 8),
              Text(
                'Started: ${alert.idleStartTimestamp.toString().substring(0, 19)}',
              ),
              const SizedBox(height: 8),
              const Text(
                'This alert has been automatically saved for safety monitoring.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _markAlertAsResolved(alert);
              },
              child: const Text('Mark Safe'),
            ),
          ],
        );
      },
    );

    _addDebugLog('📱 Displayed idle alert popup');
  }

  /// Send automatic push notification
  Future<void> _sendAutomaticPushNotification(SafetyAlert alert) async {
    try {
      await _notifications.show(
        alert.id.hashCode,
        'Safety Alert: Idle Detected',
        'You have been idle for an extended period. Tap to review.',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'idle_alerts',
            'Idle Detection Alerts',
            channelDescription: 'Automatic notifications for idle detection',
            importance: Importance.high,
            priority: Priority.high,
            showWhen: true,
          ),
        ),
      );

      _addDebugLog('📩 Push notification sent');
    } catch (e) {
      _addDebugLog('❌ Push notification failed: $e');
    }
  }

  /// Enrich alert with Gemini API analysis asynchronously
  void _enrichAlertWithGeminiAsync(SafetyAlert alert) async {
    try {
      _addDebugLog('🤖 Starting Gemini API enrichment...');

      // Use the alert processor service for complete processing with Gemini API integration
      await _alertProcessor.processAlertAutomatically(alert);

      _addDebugLog('✅ Gemini API enrichment completed');
    } catch (e) {
      _addDebugLog('❌ Gemini enrichment failed: $e');
    }
  }

  /// Mark alert as resolved
  Future<void> _markAlertAsResolved(SafetyAlert alert) async {
    try {
      await _firestore.collection('safety_alerts').doc(alert.id).update({
        'resolved': true,
        'resolvedAt': FieldValue.serverTimestamp(),
      });

      _addDebugLog('✅ Alert ${alert.id} marked as resolved');
    } catch (e) {
      _addDebugLog('❌ Failed to mark alert as resolved: $e');
    }
  }

  Future<void> _initNotifications() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
    );

    await _notifications.initialize(settings);

    // Request notification permissions
    NotificationSettings notificationSettings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    print(
      'User granted permission: ${notificationSettings.authorizationStatus}',
    );

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      _showNotification(message);
    });
  }

  Future<void> _showNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
          'fcm_channel',
          'FCM Notifications',
          channelDescription: 'Firebase Cloud Messaging notifications',
          importance: Importance.max,
          priority: Priority.high,
        );

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
    );

    await _notifications.show(
      message.hashCode,
      message.notification?.title ?? 'Notification',
      message.notification?.body ?? 'You have a new message',
      platformChannelSpecifics,
    );
  }

  Future<void> _requestPermissions() async {
    await Permission.locationWhenInUse.request();
    await Permission.notification.request();
  }

  Future<void> _loadRestrictedZones() async {
    try {
      final QuerySnapshot snapshot = await _firestore
          .collection('restricted_zones')
          .get();

      for (final doc in snapshot.docs) {
        final data = doc.data() as Map<String, dynamic>;
        final List<dynamic> points = data['polygon'];
        final String name = data['name'];
        final String description = data['description'];
        final String level = data['risk_level'];

        final List<LatLng> polygonPoints = points.map((point) {
          return LatLng(point['latitude'], point['longitude']);
        }).toList();

        // Determine color based on risk level
        Color polygonColor = Colors.orange;
        if (level == 'high') {
          polygonColor = Colors.red;
        } else if (level == 'medium') {
          polygonColor = Colors.orange;
        } else {
          polygonColor = Colors.yellow;
        }

        setState(() {
          _polygons.add(
            Polygon(
              polygonId: PolygonId(doc.id),
              points: polygonPoints,
              strokeWidth: 2,
              strokeColor: polygonColor,
              fillColor: polygonColor.withOpacity(0.15),
              consumeTapEvents: true,
              onTap: () {
                _showZoneInfo(name, description, level);
              },
            ),
          );

          // Add marker at the center of the polygon
          final LatLng center = _calculateCenter(polygonPoints);
          _markers.add(
            Marker(
              markerId: MarkerId(doc.id),
              position: center,
              infoWindow: InfoWindow(
                title: name,
                snippet: 'Risk Level: $level',
              ),
            ),
          );
        });
      }
    } catch (e) {
      print('Error loading restricted zones: $e');
    }
  }

  LatLng _calculateCenter(List<LatLng> points) {
    double lat = 0, lng = 0;
    for (final point in points) {
      lat += point.latitude;
      lng += point.longitude;
    }
    return LatLng(lat / points.length, lng / points.length);
  }

  void _showZoneInfo(String name, String description, String level) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(name),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(description),
              const SizedBox(height: 10),
              Text(
                'Risk Level: ${level.toUpperCase()}',
                style: TextStyle(
                  color: level == 'high'
                      ? Colors.red
                      : level == 'medium'
                      ? Colors.orange
                      : Colors.yellow[700],
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _startLocationTracking() async {
    // Get current position
    _currentPosition = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    // Set up stream for continuous location updates
    _positionStream =
        Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 10, // Update every 10 meters
          ),
        ).listen((Position position) {
          setState(() {
            _currentPosition = position;
          });

          // Check if user entered any restricted zone
          _checkZones(position);
        });
  }

  Future<void> _checkZones(Position position) async {
    final LatLng userLocation = LatLng(position.latitude, position.longitude);

    try {
      final QuerySnapshot snapshot = await _firestore
          .collection('restricted_zones')
          .get();

      for (final doc in snapshot.docs) {
        final data = doc.data() as Map<String, dynamic>;
        final List<dynamic> points = data['polygon'];
        final String name = data['name'];
        final String description = data['description'];
        final String level = data['risk_level'];

        final List<LatLng> polygonPoints = points.map((point) {
          return LatLng(point['latitude'], point['longitude']);
        }).toList();

        // Check if user is inside this polygon
        if (_isPointInPolygon(userLocation, polygonPoints)) {
          // Send notification
          _sendZoneAlert(name, description, level);
          break; // Only alert for one zone at a time
        }
      }
    } catch (e) {
      print('Error checking zones: $e');
    }
  }

  bool _isPointInPolygon(LatLng point, List<LatLng> polygon) {
    // Ray casting algorithm to check if point is inside polygon
    int i, j = polygon.length - 1;
    bool isInside = false;

    for (i = 0; i < polygon.length; i++) {
      if ((polygon[i].latitude > point.latitude) !=
              (polygon[j].latitude > point.latitude) &&
          (point.longitude <
              (polygon[j].longitude - polygon[i].longitude) *
                      (point.latitude - polygon[i].latitude) /
                      (polygon[j].latitude - polygon[i].latitude) +
                  polygon[i].longitude)) {
        isInside = !isInside;
      }
      j = i;
    }

    return isInside;
  }

  Future<void> _sendZoneAlert(
    String name,
    String description,
    String level,
  ) async {
    // Send local notification
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
          'zone_alerts_channel',
          'Zone Alerts',
          channelDescription: 'Notifications for entering restricted zones',
          importance: Importance.max,
          priority: Priority.high,
        );

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
    );

    await _notifications.show(
      0,
      'Warning: Entering Restricted Zone',
      'You have entered $name. $description',
      platformChannelSpecifics,
    );

    // Also send to FCM for cross-device sync (if needed)
    // This would typically be done from a server
  }

  Future<void> _handleSignOut() async {
    try {
      await AuthService().signOut();
      // Navigation is handled by FirebaseAuth.authStateChanges() in main.dart
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Signed out')));
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Sign out failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tourist Geo-fencing'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        actionsIconTheme: const IconThemeData(color: Colors.white),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'More',
            onSelected: (value) {
              if (value == 'sign_out') {
                _handleSignOut();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem<String>(
                value: 'sign_out',
                child: Row(
                  children: [
                    Icon(Icons.logout),
                    SizedBox(width: 8),
                    Text('Sign out'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _currentPosition == null
          ? const Center(child: CircularProgressIndicator())
          : GoogleMap(
              mapType: MapType.normal,
              initialCameraPosition: CameraPosition(
                target: LatLng(
                  _currentPosition!.latitude,
                  _currentPosition!.longitude,
                ),
                zoom: 14,
              ),
              polygons: _polygons,
              markers: _markers,
              myLocationEnabled: true,
              myLocationButtonEnabled: true,
              onMapCreated: (GoogleMapController controller) {
                _controller.complete(controller);
              },
            ),
    );
  }
}
