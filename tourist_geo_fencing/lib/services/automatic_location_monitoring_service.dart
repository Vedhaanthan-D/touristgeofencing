import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/safety_alert.dart';
import '../services/location_monitor_config.dart';
import 'automatic_idle_detector.dart';
import 'automatic_alert_processor.dart';
import 'automatic_notification_service.dart';
import 'current_user_service.dart';

/// Fully automatic location monitoring service that runs continuously
/// without any manual intervention or user interaction required
class AutomaticLocationMonitoringService {
  static final AutomaticLocationMonitoringService _instance = 
      AutomaticLocationMonitoringService._internal();
  factory AutomaticLocationMonitoringService() => _instance;
  AutomaticLocationMonitoringService._internal();

  // Core services for automatic operation
  final AutomaticIdleDetector _idleDetector = AutomaticIdleDetector();
  final AutomaticAlertProcessor _alertProcessor = AutomaticAlertProcessor();
  final AutomaticNotificationService _notificationService = AutomaticNotificationService();

  // State management
  Timer? _locationTimer;
  StreamSubscription<Position>? _positionStream;
  bool _isMonitoring = false;
  bool _isInitialized = false;
  Position? _lastPosition;
  DateTime? _lastLocationUpdate;
  int _consecutiveErrors = 0;
  static const int _maxRetries = 3;

  // Current user context
  String _currentUserId = 'auto_user'; // Will be set automatically

  /// Automatically initialize and start the monitoring service
  /// This runs without any user interaction
  Future<bool> initializeAutomaticMonitoring() async {
    if (_isInitialized) return true;

    try {
      print('🚀 Initializing automatic location monitoring...');
      
      // Step 1: Request necessary permissions automatically
      final permissionsGranted = await _requestPermissionsAutomatically();
      if (!permissionsGranted) {
        print('❌ Failed to obtain required permissions');
        return false;
      }

      // Step 2: Check location services
      if (!await Geolocator.isLocationServiceEnabled()) {
        print('❌ Location services are disabled');
        return false;
      }

      // Step 3: Initialize all automatic services
      await _initializeServices();

      // Step 4: Set up automatic callbacks and error handlers
      _setupAutomaticCallbacks();

      // Step 5: Start automatic monitoring immediately
      await _startAutomaticMonitoring();

      _isInitialized = true;
      print('✅ Automatic location monitoring initialized successfully');
      return true;

    } catch (e) {
      print('❌ Error initializing automatic monitoring: $e');
      return false;
    }
  }

  /// Request all necessary permissions automatically
  Future<bool> _requestPermissionsAutomatically() async {
    try {
      // Location permission
      var locationStatus = await Permission.location.status;
      if (!locationStatus.isGranted) {
        locationStatus = await Permission.location.request();
        if (!locationStatus.isGranted) return false;
      }

      // Location always permission for background tracking
      var locationAlwaysStatus = await Permission.locationAlways.status;
      if (!locationAlwaysStatus.isGranted) {
        locationAlwaysStatus = await Permission.locationAlways.request();
        // Continue even if not granted, but log it
        if (!locationAlwaysStatus.isGranted) {
          print('⚠️ Background location permission not granted - monitoring may be limited');
        }
      }

      // Notification permission
      var notificationStatus = await Permission.notification.status;
      if (!notificationStatus.isGranted) {
        notificationStatus = await Permission.notification.request();
      }

      return true;
    } catch (e) {
      print('❌ Error requesting permissions: $e');
      return false;
    }
  }

  /// Initialize all automatic services
  Future<void> _initializeServices() async {
    await _idleDetector.initialize();
    await _alertProcessor.initialize();
    await _notificationService.initialize();
  }

  /// Set up automatic callbacks between services
  void _setupAutomaticCallbacks() {
    // Automatic idle detection callback
    _idleDetector.onIdleThresholdReached = (idleSession) async {
      await _handleAutomaticIdleAlert(idleSession);
    };

    // Automatic alert processing callback
    _alertProcessor.onAlertProcessed = (alert) async {
      await _handleProcessedAlert(alert);
    };

    // Error handling callbacks
    _alertProcessor.onError = (error) => _handleServiceError('AlertProcessor', error);
    _idleDetector.onError = (error) => _handleServiceError('IdleDetector', error);
  }

  /// Start automatic location monitoring
  Future<void> _startAutomaticMonitoring() async {
    if (_isMonitoring) return;

    print('🔄 Starting automatic location monitoring...');
    _isMonitoring = true;
    _consecutiveErrors = 0;

    // Start periodic location updates (1 minute intervals)
    _locationTimer = Timer.periodic(
      LocationMonitorConfig.locationUpdateInterval,
      (_) => _performAutomaticLocationUpdate(),
    );

    // Get initial location immediately
    await _performAutomaticLocationUpdate();

    print('✅ Automatic location monitoring started');
  }

  /// Perform automatic location update without user intervention
  Future<void> _performAutomaticLocationUpdate() async {
    // Skip if outside monitoring window
    if (!_isWithinMonitoringWindow()) {
      return;
    }

    try {
      // Get current position with timeout and error handling
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 45),
      ).timeout(
        const Duration(seconds: 60),
        onTimeout: () => throw TimeoutException('Location timeout', const Duration(seconds: 60)),
      );

      // Validate location data
      if (!_isValidLocation(position.latitude, position.longitude)) {
        print('⚠️ Invalid location received, skipping...');
        return;
      }

      // Reset error counter on successful location
      _consecutiveErrors = 0;
      _lastPosition = position;
      _lastLocationUpdate = DateTime.now();

      // Create user location object
      final userLocation = UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: DateTime.now(),
        accuracy: position.accuracy,
      );

      // Automatically process with idle detector
      await _idleDetector.processLocationUpdate(userLocation);

      print('📍 Location updated automatically: ${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}');

    } catch (e) {
      await _handleLocationError(e);
    }
  }

  /// Handle location update errors with automatic retry
  Future<void> _handleLocationError(dynamic error) async {
    _consecutiveErrors++;
    print('❌ Location error ($error): $_consecutiveErrors/$_maxRetries');

    if (_consecutiveErrors >= _maxRetries) {
      print('🔄 Max retries reached, implementing backoff strategy...');
      
      // Implement exponential backoff
      await Future.delayed(Duration(seconds: 30 * _consecutiveErrors));
      
      // Try to restart location services
      await _restartLocationServices();
    } else {
      // Short delay before next attempt
      await Future.delayed(const Duration(seconds: 10));
    }
  }

  /// Restart location services automatically
  Future<void> _restartLocationServices() async {
    try {
      print('🔄 Restarting location services...');
      
      // Cancel existing timer and streams
      _locationTimer?.cancel();
      await _positionStream?.cancel();
      
      // Wait a moment
      await Future.delayed(const Duration(seconds: 5));
      
      // Restart monitoring
      await _startAutomaticMonitoring();
      
      _consecutiveErrors = 0;
      print('✅ Location services restarted successfully');
    } catch (e) {
      print('❌ Failed to restart location services: $e');
    }
  }

  /// Automatically handle idle alert when threshold is reached
  Future<void> _handleAutomaticIdleAlert(IdleSession idleSession) async {
    try {
      print('🚨 Automatic idle alert triggered!');
      
      // Create safety alert record
      final alert = SafetyAlert(
        userId: CurrentUserService().uid ?? _currentUserId,
        dtid: CurrentUserService().dtid ?? '',
        latitude: idleSession.initialLocation.latitude,
        longitude: idleSession.initialLocation.longitude,
        idleStartTimestamp: idleSession.startTime,
        idleDuration: idleSession.currentDuration,
      );

      // Automatically process the alert (store + enrich with Gemini)
      await _alertProcessor.processAlertAutomatically(alert);

    } catch (e) {
      print('❌ Error handling automatic idle alert: $e');
      await _retryAlertProcessing(idleSession);
    }
  }

  /// Handle processed alert with automatic notifications
  Future<void> _handleProcessedAlert(SafetyAlert alert) async {
    try {
      print('✅ Alert processed, sending automatic notifications...');
      
      // Automatically send all notifications
      await _notificationService.sendAllNotificationsAutomatically(alert);
      
      print('🔔 All automatic notifications sent successfully');
    } catch (e) {
      print('❌ Error in automatic notifications: $e');
    }
  }

  /// Retry alert processing with exponential backoff
  Future<void> _retryAlertProcessing(IdleSession idleSession) async {
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('🔄 Retrying alert processing (attempt $attempt/$_maxRetries)...');
        
        await Future.delayed(Duration(seconds: 5 * attempt));
        await _handleAutomaticIdleAlert(idleSession);
        
        print('✅ Alert processing retry successful');
        return;
      } catch (e) {
        print('❌ Retry attempt $attempt failed: $e');
      }
    }
    
    print('🚫 All retry attempts failed for alert processing');
  }

  /// Handle service errors automatically
  void _handleServiceError(String serviceName, dynamic error) {
    print('❌ Service error in $serviceName: $error');
    // Log error and continue monitoring
  }

  /// Check if current time is within monitoring window
  bool _isWithinMonitoringWindow() {
    final now = DateTime.now();
    final hour = now.hour;
    return hour >= LocationMonitorConfig.morningStartHour && 
           hour <= LocationMonitorConfig.morningEndHour;
  }

  /// Validate location coordinates
  bool _isValidLocation(double latitude, double longitude) {
    return latitude >= -90.0 && latitude <= 90.0 &&
           longitude >= -180.0 && longitude <= 180.0 &&
           latitude != 0.0 && longitude != 0.0; // Exclude null island
  }

  /// Set user ID for automatic monitoring
  void setUserId(String userId) {
    _currentUserId = userId;
    _alertProcessor.setUserId(userId);
    print('👤 Automatic monitoring user ID set to: $userId');
  }

  /// Get current monitoring status
  Map<String, dynamic> getAutomaticMonitoringStatus() {
    return {
      'isInitialized': _isInitialized,
      'isMonitoring': _isMonitoring,
      'lastUpdate': _lastLocationUpdate?.toIso8601String(),
      'lastPosition': _lastPosition != null ? {
        'latitude': _lastPosition!.latitude,
        'longitude': _lastPosition!.longitude,
        'accuracy': _lastPosition!.accuracy,
      } : null,
      'consecutiveErrors': _consecutiveErrors,
      'idleStatus': _idleDetector.getCurrentStatus(),
      'withinWindow': _isWithinMonitoringWindow(),
    };
  }

  /// Stop automatic monitoring (for cleanup)
  void stopAutomaticMonitoring() {
    if (!_isMonitoring) return;

    print('🛑 Stopping automatic monitoring...');
    
    _locationTimer?.cancel();
    _positionStream?.cancel();
    _isMonitoring = false;
    
    _idleDetector.dispose();
    _alertProcessor.dispose();
    
    print('✅ Automatic monitoring stopped');
  }

  /// Public methods for UI interaction
  bool get isMonitoringActive => _isMonitoring;
  
  Future<void> startAutomaticMonitoring() async {
    if (!_isInitialized) {
      final success = await initializeAutomaticMonitoring();
      if (!success) {
        throw Exception('Failed to initialize automatic monitoring');
      }
    } else if (!_isMonitoring) {
      await _startAutomaticMonitoring();
    }
  }

  /// Dispose all resources
  void dispose() {
    stopAutomaticMonitoring();
    _isInitialized = false;
  }

  /// Get singleton instance
  static AutomaticLocationMonitoringService get instance => _instance;
}