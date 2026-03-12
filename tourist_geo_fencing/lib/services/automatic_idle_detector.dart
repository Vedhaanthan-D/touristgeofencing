import 'dart:async';
import '../models/safety_alert.dart';
import '../services/location_monitor_config.dart';
import '../utils/location_utils.dart';

/// Automatic idle detection service that monitors user location 
/// continuously and triggers alerts when idle thresholds are reached
class AutomaticIdleDetector {
  // Current idle session
  IdleSession? _currentSession;
  
  // Automatic checking timer
  Timer? _automaticCheckTimer;
  static const Duration _checkInterval = Duration(seconds: 30);
  
  // State management
  bool _isInitialized = false;
  bool _isMonitoring = false;
  
  // Automatic callbacks
  Function(IdleSession)? onIdleThresholdReached;
  Function(String)? onError;
  
  /// Initialize automatic idle detection
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    print('🔧 Initializing automatic idle detector...');
    
    // Start automatic monitoring immediately
    await _startAutomaticMonitoring();
    
    _isInitialized = true;
    print('✅ Automatic idle detector initialized');
  }
  
  /// Start automatic idle monitoring
  Future<void> _startAutomaticMonitoring() async {
    if (_isMonitoring) return;
    
    _isMonitoring = true;
    
    // Start automatic periodic checking
    _automaticCheckTimer = Timer.periodic(_checkInterval, (_) {
      _performAutomaticIdleCheck();
    });
    
    print('🔄 Automatic idle monitoring started');
  }
  
  /// Process location update automatically
  Future<void> processLocationUpdate(UserLocation newLocation) async {
    if (!_isInitialized || !_isMonitoring) return;
    
    try {
      if (_currentSession == null) {
        // No active session - start new idle session automatically
        await _startNewIdleSession(newLocation);
      } else {
        // Check if still within idle range
        if (LocationUtils.isLocationWithinRange(newLocation, _currentSession!.initialLocation)) {
          // Still idle - update session automatically
          _currentSession!.updateLastSeen();
          print('📍 Idle session continues: ${_formatDuration(_currentSession!.currentDuration)}');
        } else {
          // User moved - end idle session automatically
          await _endCurrentIdleSession();
          print('🚶 User movement detected - idle session ended');
        }
      }
    } catch (e) {
      onError?.call('Error processing location update: $e');
    }
  }
  
  /// Start new idle session automatically
  Future<void> _startNewIdleSession(UserLocation location) async {
    _currentSession = IdleSession(
      initialLocation: location,
      startTime: DateTime.now(),
    );
    
    print('⏱️ New idle session started at ${LocationUtils.formatLocation(location.latitude, location.longitude)}');
  }
  
  /// End current idle session automatically
  Future<void> _endCurrentIdleSession() async {
    if (_currentSession != null) {
      final duration = _currentSession!.currentDuration;
      print('⏹️ Idle session ended after ${_formatDuration(duration)}');
      _currentSession = null;
    }
  }
  
  /// Perform automatic idle threshold checking
  void _performAutomaticIdleCheck() {
    if (_currentSession == null) return;
    
    try {
      final currentDuration = _currentSession!.currentDuration;
      final threshold = LocationMonitorConfig.currentIdleThreshold;
      
      print('⏰ Checking idle threshold: ${_formatDuration(currentDuration)} / ${_formatDuration(threshold)}');
      
      if (currentDuration >= threshold) {
        _triggerAutomaticIdleAlert();
      }
    } catch (e) {
      onError?.call('Error in automatic idle check: $e');
    }
  }
  
  /// Trigger automatic idle alert when threshold reached
  void _triggerAutomaticIdleAlert() {
    if (_currentSession == null) return;
    
    try {
      print('🚨 AUTOMATIC IDLE ALERT TRIGGERED! Duration: ${_formatDuration(_currentSession!.currentDuration)}');
      
      // Create a copy of the current session for the callback
      final alertSession = IdleSession(
        initialLocation: _currentSession!.initialLocation,
        startTime: _currentSession!.startTime,
      );
      alertSession.lastUpdateTime = _currentSession!.lastUpdateTime;
      
      // Trigger automatic callback
      onIdleThresholdReached?.call(alertSession);
      
      // End the current session after triggering alert
      _endCurrentIdleSession();
      
      print('✅ Automatic idle alert processing initiated');
      
    } catch (e) {
      onError?.call('Error triggering automatic idle alert: $e');
    }
  }
  
  /// Get current automatic monitoring status
  Map<String, dynamic> getCurrentStatus() {
    if (_currentSession == null) {
      return {
        'isActive': false,
        'sessionDuration': Duration.zero,
        'timeUntilAlert': null,
        'location': null,
        'startTime': null,
        'mode': LocationMonitorConfig.isTestMode ? 'TEST' : 'PRODUCTION',
        'threshold': LocationMonitorConfig.currentIdleThreshold.inMilliseconds,
      };
    }
    
    final currentDuration = _currentSession!.currentDuration;
    final threshold = LocationMonitorConfig.currentIdleThreshold;
    final timeUntilAlert = threshold - currentDuration;
    
    return {
      'isActive': true,
      'sessionDuration': currentDuration.inMilliseconds,
      'timeUntilAlert': timeUntilAlert.isNegative ? 0 : timeUntilAlert.inMilliseconds,
      'location': {
        'latitude': _currentSession!.initialLocation.latitude,
        'longitude': _currentSession!.initialLocation.longitude,
        'accuracy': _currentSession!.initialLocation.accuracy,
      },
      'startTime': _currentSession!.startTime.toIso8601String(),
      'mode': LocationMonitorConfig.isTestMode ? 'TEST' : 'PRODUCTION',
      'threshold': threshold.inMilliseconds,
      'progress': currentDuration.inMilliseconds / threshold.inMilliseconds,
    };
  }
  
  /// Check if currently in idle session
  bool get hasActiveSession => _currentSession != null;
  
  /// Get current idle duration if session is active
  Duration? get currentIdleDuration => _currentSession?.currentDuration;
  
  /// Get time remaining until alert
  Duration? get timeUntilAlert {
    if (_currentSession == null) return null;
    
    final remaining = LocationMonitorConfig.currentIdleThreshold - _currentSession!.currentDuration;
    return remaining.isNegative ? Duration.zero : remaining;
  }
  
  /// Force end current session (for testing)
  void forceEndCurrentSession() {
    if (_currentSession != null) {
      print('🔧 Forcing idle session end');
      _endCurrentIdleSession();
    }
  }
  
  /// Force trigger alert (for testing)
  void forceTriggerAlert() {
    if (_currentSession != null) {
      print('🔧 Force triggering idle alert for testing');
      _triggerAutomaticIdleAlert();
    }
  }
  
  /// Format duration for logging
  String _formatDuration(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h ${duration.inMinutes % 60}m';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inMinutes}m ${duration.inSeconds % 60}s';
    }
  }
  
  /// Stop automatic monitoring
  void _stopAutomaticMonitoring() {
    if (!_isMonitoring) return;
    
    _automaticCheckTimer?.cancel();
    _isMonitoring = false;
    
    print('🛑 Automatic idle monitoring stopped');
  }
  
  /// Dispose resources
  void dispose() {
    _stopAutomaticMonitoring();
    _endCurrentIdleSession();
    _isInitialized = false;
    
    print('🗑️ Automatic idle detector disposed');
  }
}