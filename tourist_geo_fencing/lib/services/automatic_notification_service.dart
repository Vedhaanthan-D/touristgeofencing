import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/safety_alert.dart';
import '../widgets/safety_alert_dialog.dart';
import 'automatic_global_context.dart';

/// Automatic notification service that handles in-app alerts, 
/// push notifications, and popups without user intervention
class AutomaticNotificationService {
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  
  // State management
  bool _isInitialized = false;
  
  // Callbacks
  Function(String)? onError;
  
  // Retry configuration
  static const int _maxRetries = 3;
  static const Duration _retryDelay = Duration(seconds: 2);
  
  /// Initialize automatic notification service
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    print('🔧 Initializing automatic notification service...');
    
    try {
      // Initialize notification plugin
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initializationSettings = InitializationSettings(android: androidSettings);
      
      await _notifications.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: _handleNotificationTap,
      );
      
      // Create notification channels
      await _createNotificationChannels();
      
      _isInitialized = true;
      print('✅ Automatic notification service initialized');
      
    } catch (e) {
      print('❌ Failed to initialize notification service: $e');
      onError?.call('Notification initialization failed: $e');
    }
  }
  
  /// Create notification channels for different alert types
  Future<void> _createNotificationChannels() async {
    final androidPlugin = _notifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    
    if (androidPlugin != null) {
      // Safety alerts channel (high priority)
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          'safety_alerts',
          'Safety Alerts',
          description: 'Critical safety alerts for idle detection',
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
        ),
      );
      
      // Status updates channel (lower priority)
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          'status_updates',
          'Status Updates',
          description: 'Monitoring status and system updates',
          importance: Importance.low,
          playSound: false,
          enableVibration: false,
        ),
      );
    }
  }
  
  /// Send all notifications automatically for a safety alert
  Future<void> sendAllNotificationsAutomatically(SafetyAlert alert) async {
    if (!_isInitialized) await initialize();
    
    print('🔔 Sending all automatic notifications for alert...');
    
    // Send notifications in parallel for faster delivery
    final futures = [
      _sendPushNotificationAutomatically(alert),
      _showInAppPopupAutomatically(alert),
      _sendSystemNotificationAutomatically(alert),
    ];
    
    // Wait for all notifications to complete (with individual error handling)
    final results = await Future.wait(
      futures.map((future) => future.catchError((e) {
        print('❌ Individual notification failed: $e');
        return false;
      })),
    );
    
    final successCount = results.where((result) => result == true).length;
    print('✅ Sent $successCount/${results.length} notifications successfully');
  }
  
  /// Send push notification automatically
  Future<bool> _sendPushNotificationAutomatically(SafetyAlert alert) async {
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('📱 Sending push notification (attempt $attempt/$_maxRetries)...');
        
        final riskLevel = _extractRiskLevel(alert);
        final priority = _getPriority(riskLevel);
        
        final androidDetails = AndroidNotificationDetails(
          'safety_alerts',
          'Safety Alerts',
          channelDescription: 'Critical safety alerts for idle detection',
          importance: Importance.high,
          priority: priority,
          playSound: true,
          enableVibration: true,
          ongoing: riskLevel == 'CRITICAL' || riskLevel == 'HIGH',
          autoCancel: false,
          icon: '@mipmap/ic_launcher',
          styleInformation: BigTextStyleInformation(
            _buildNotificationBody(alert),
            contentTitle: 'Safety Alert: $riskLevel Risk Detected',
          ),
        );
        
        final notificationDetails = NotificationDetails(android: androidDetails);
        
        await _notifications.show(
          alert.id?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
          'Safety Alert: $riskLevel Risk',
          _buildNotificationBody(alert),
          notificationDetails,
          payload: alert.id,
        );
        
        print('✅ Push notification sent successfully');
        return true;
        
      } catch (e) {
        print('❌ Push notification attempt $attempt failed: $e');
        if (attempt < _maxRetries) {
          await Future.delayed(_retryDelay * attempt);
        }
      }
    }
    
    onError?.call('Failed to send push notification after $_maxRetries attempts');
    return false;
  }
  
  /// Show in-app popup automatically
  Future<bool> _showInAppPopupAutomatically(SafetyAlert alert) async {
    try {
      print('📲 Showing in-app popup automatically...');
      
      final context = AutomaticGlobalContext.getCurrentContext();
      if (context == null) {
        print('⚠️ No context available for in-app popup');
        return false;
      }
      
      // Show popup without blocking
      unawaited(_showPopupDialog(context, alert));
      
      print('✅ In-app popup displayed');
      return true;
      
    } catch (e) {
      print('❌ In-app popup failed: $e');
      onError?.call('In-app popup failed: $e');
      return false;
    }
  }
  
  /// Show popup dialog
  Future<void> _showPopupDialog(BuildContext context, SafetyAlert alert) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => SafetyAlertDialog(
        alert: alert,
        onDismiss: () {
          print('✅ Safety alert popup dismissed by user');
        },
        onViewDetails: () {
          print('📋 User requested to view alert details');
          // Navigate to details screen if available
        },
      ),
    );
  }
  
  /// Send system notification for logging
  Future<bool> _sendSystemNotificationAutomatically(SafetyAlert alert) async {
    try {
      print('🔔 Sending system notification...');
      
      const androidDetails = AndroidNotificationDetails(
        'status_updates',
        'Status Updates',
        channelDescription: 'Monitoring status and system updates',
        importance: Importance.low,
        priority: Priority.low,
        playSound: false,
        enableVibration: false,
        ongoing: false,
        autoCancel: true,
      );
      
      const notificationDetails = NotificationDetails(android: androidDetails);
      
      await _notifications.show(
        DateTime.now().millisecondsSinceEpoch + 1000,
        'Safety Monitor Active',
        'Alert processed and logged at ${DateTime.now().toString().substring(11, 16)}',
        notificationDetails,
      );
      
      print('✅ System notification sent');
      return true;
      
    } catch (e) {
      print('❌ System notification failed: $e');
      return false;
    }
  }
  
  /// Send status update notification
  Future<void> sendStatusUpdateAutomatically(String title, String message) async {
    try {
      if (!_isInitialized) await initialize();
      
      print('📊 Sending automatic status update: $title');
      
      const androidDetails = AndroidNotificationDetails(
        'status_updates',
        'Status Updates',
        importance: Importance.low,
        priority: Priority.low,
        playSound: false,
        enableVibration: false,
        autoCancel: true,
      );
      
      const notificationDetails = NotificationDetails(android: androidDetails);
      
      await _notifications.show(
        DateTime.now().millisecondsSinceEpoch,
        title,
        message,
        notificationDetails,
      );
      
    } catch (e) {
      print('❌ Status update notification failed: $e');
    }
  }
  
  /// Send emergency alert with maximum priority
  Future<void> sendEmergencyAlertAutomatically(SafetyAlert alert) async {
    try {
      print('🚨 SENDING EMERGENCY ALERT AUTOMATICALLY');
      
      const androidDetails = AndroidNotificationDetails(
        'safety_alerts',
        'Safety Alerts',
        channelDescription: 'Critical safety alerts for idle detection',
        importance: Importance.max,
        priority: Priority.max,
        playSound: true,
        enableVibration: true,
        ongoing: true,
        autoCancel: false,
        fullScreenIntent: true,
        category: AndroidNotificationCategory.alarm,
        visibility: NotificationVisibility.public,
        styleInformation: BigTextStyleInformation(
          '🚨 EMERGENCY: Extended idle period detected. Please check your safety status immediately.',
          contentTitle: '🚨 EMERGENCY SAFETY ALERT',
        ),
      );
      
      const notificationDetails = NotificationDetails(android: androidDetails);
      
      await _notifications.show(
        999999, // High priority ID
        '🚨 EMERGENCY SAFETY ALERT',
        'Extended idle period detected - immediate attention required',
        notificationDetails,
        payload: 'emergency_${alert.id}',
      );
      
      print('🚨 Emergency alert sent successfully');
      
    } catch (e) {
      print('❌ Emergency alert failed: $e');
      onError?.call('CRITICAL: Emergency alert failed: $e');
    }
  }
  
  /// Handle notification tap
  void _handleNotificationTap(NotificationResponse response) {
    print('👆 Notification tapped: ${response.payload}');
    
    try {
      final context = AutomaticGlobalContext.getCurrentContext();
      if (context != null) {
        // Navigate to appropriate screen based on payload
        if (response.payload?.startsWith('emergency_') == true) {
          print('🚨 Emergency notification tapped');
          // Handle emergency navigation
        } else {
          print('📋 Regular alert notification tapped');
          // Handle regular alert navigation
        }
      }
    } catch (e) {
      print('❌ Error handling notification tap: $e');
    }
  }
  
  /// Build notification body text
  String _buildNotificationBody(SafetyAlert alert) {
    final duration = _formatDuration(alert.idleDuration);
    final location = '${alert.latitude.toStringAsFixed(4)}, ${alert.longitude.toStringAsFixed(4)}';
    
    String body = '⏰ Idle for $duration at $location';
    
    // Add AI insights if available
    final analysis = alert.geminiAnalysis;
    if (analysis != null && analysis['riskLevel'] != null) {
      body = '🚨 ${analysis['riskLevel']} risk detected. $body';
    }
    
    return body;
  }
  
  /// Extract risk level from alert
  String _extractRiskLevel(SafetyAlert alert) {
    final analysis = alert.geminiAnalysis;
    if (analysis != null && analysis['riskLevel'] != null) {
      return analysis['riskLevel'].toString();
    }
    
    // Fallback based on duration
    if (alert.idleDuration.inHours >= 6) return 'HIGH';
    if (alert.idleDuration.inHours >= 3) return 'MODERATE';
    return 'LOW';
  }
  
  /// Get notification priority based on risk level
  Priority _getPriority(String riskLevel) {
    switch (riskLevel.toUpperCase()) {
      case 'CRITICAL':
        return Priority.max;
      case 'HIGH':
        return Priority.high;
      case 'MODERATE':
        return Priority.defaultPriority;
      case 'LOW':
      default:
        return Priority.low;
    }
  }
  
  /// Format duration for display
  String _formatDuration(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inMinutes}m';
    }
  }
  
  /// Cancel all notifications
  Future<void> cancelAllNotifications() async {
    try {
      await _notifications.cancelAll();
      print('🗑️ All notifications cancelled');
    } catch (e) {
      print('❌ Failed to cancel notifications: $e');
    }
  }
  
  /// Get notification service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'isInitialized': _isInitialized,
      'maxRetries': _maxRetries,
      'retryDelay': _retryDelay.inSeconds,
    };
  }
  
  /// Dispose resources
  void dispose() {
    _isInitialized = false;
    print('🗑️ Automatic notification service disposed');
  }
}