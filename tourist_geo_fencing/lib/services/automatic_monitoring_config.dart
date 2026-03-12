import 'package:shared_preferences/shared_preferences.dart';

/// Enhanced configuration for automatic monitoring system
class AutomaticMonitoringConfig {
  // GPS accuracy threshold (±0.0045 degrees = ~500 meters)
  static const double latitudeThreshold = 0.0045;
  static const double longitudeThreshold = 0.0045;
  
  // Location update frequency (1 minute as required)
  static const Duration locationUpdateInterval = Duration(minutes: 1);
  
  // Idle detection thresholds
  static const Duration testModeIdleDuration = Duration(minutes: 1);
  static const Duration productionModeIdleDuration = Duration(hours: 5, minutes: 30);
  
  // Default monitoring time window (6 AM to 12 PM)
  static const int defaultMorningStartHour = 6;
  static const int defaultMorningEndHour = 12;
  
  // Current configuration (persistent)
  static bool _isTestMode = true;
  static int _morningStartHour = defaultMorningStartHour;
  static int _morningEndHour = defaultMorningEndHour;
  static bool _autoStartMonitoring = true;
  static bool _enableBackgroundMode = true;
  
  // Persistence keys
  static const String _keyTestMode = 'auto_monitor_test_mode';
  static const String _keyStartHour = 'auto_monitor_start_hour';
  static const String _keyEndHour = 'auto_monitor_end_hour';
  static const String _keyAutoStart = 'auto_monitor_auto_start';
  static const String _keyBackground = 'auto_monitor_background';
  
  /// Initialize configuration from persistent storage
  static Future<void> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      _isTestMode = prefs.getBool(_keyTestMode) ?? true;
      _morningStartHour = prefs.getInt(_keyStartHour) ?? defaultMorningStartHour;
      _morningEndHour = prefs.getInt(_keyEndHour) ?? defaultMorningEndHour;
      _autoStartMonitoring = prefs.getBool(_keyAutoStart) ?? true;
      _enableBackgroundMode = prefs.getBool(_keyBackground) ?? true;
      
      print('✅ Automatic monitoring configuration loaded');
      print('   Test mode: $_isTestMode');
      print('   Time window: $_morningStartHour:00 - $_morningEndHour:00');
      print('   Auto start: $_autoStartMonitoring');
      print('   Background mode: $_enableBackgroundMode');
      
    } catch (e) {
      print('❌ Failed to load configuration, using defaults: $e');
    }
  }
  
  /// Save configuration to persistent storage
  static Future<void> save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      await Future.wait([
        prefs.setBool(_keyTestMode, _isTestMode),
        prefs.setInt(_keyStartHour, _morningStartHour),
        prefs.setInt(_keyEndHour, _morningEndHour),
        prefs.setBool(_keyAutoStart, _autoStartMonitoring),
        prefs.setBool(_keyBackground, _enableBackgroundMode),
      ]);
      
      print('✅ Configuration saved successfully');
      
    } catch (e) {
      print('❌ Failed to save configuration: $e');
    }
  }
  
  // Getters and setters with automatic persistence
  
  /// Test mode configuration
  static bool get isTestMode => _isTestMode;
  static set isTestMode(bool value) {
    _isTestMode = value;
    save();
  }
  
  /// Morning monitoring window start hour
  static int get morningStartHour => _morningStartHour;
  static set morningStartHour(int value) {
    if (value >= 0 && value <= 23 && value < _morningEndHour) {
      _morningStartHour = value;
      save();
    }
  }
  
  /// Morning monitoring window end hour
  static int get morningEndHour => _morningEndHour;
  static set morningEndHour(int value) {
    if (value >= 0 && value <= 23 && value > _morningStartHour) {
      _morningEndHour = value;
      save();
    }
  }
  
  /// Auto-start monitoring on app launch
  static bool get autoStartMonitoring => _autoStartMonitoring;
  static set autoStartMonitoring(bool value) {
    _autoStartMonitoring = value;
    save();
  }
  
  /// Enable background monitoring
  static bool get enableBackgroundMode => _enableBackgroundMode;
  static set enableBackgroundMode(bool value) {
    _enableBackgroundMode = value;
    save();
  }
  
  // Derived configurations
  
  /// Get current idle threshold based on mode
  static Duration get currentIdleThreshold => 
      _isTestMode ? testModeIdleDuration : productionModeIdleDuration;
  
  /// Check if current time is within monitoring window
  static bool get isWithinMonitoringWindow {
    final now = DateTime.now();
    final hour = now.hour;
    return hour >= _morningStartHour && hour <= _morningEndHour;
  }
  
  /// Get threshold distance in meters for reference
  static double get thresholdDistanceMeters => 500.0; // Approximate
  
  /// Get monitoring mode description
  static String get modeDescription => 
      _isTestMode ? 'Test Mode (1 minute)' : 'Production Mode (5.5 hours)';
  
  /// Get time window description
  static String get timeWindowDescription => 
      '${_morningStartHour.toString().padLeft(2, '0')}:00 - ${_morningEndHour.toString().padLeft(2, '0')}:00';
  
  /// Update multiple settings at once
  static Future<void> updateSettings({
    bool? testMode,
    int? startHour,
    int? endHour,
    bool? autoStart,
    bool? backgroundMode,
  }) async {
    bool changed = false;
    
    if (testMode != null && testMode != _isTestMode) {
      _isTestMode = testMode;
      changed = true;
    }
    
    if (startHour != null && startHour != _morningStartHour && 
        startHour >= 0 && startHour <= 23 && startHour < _morningEndHour) {
      _morningStartHour = startHour;
      changed = true;
    }
    
    if (endHour != null && endHour != _morningEndHour && 
        endHour >= 0 && endHour <= 23 && endHour > _morningStartHour) {
      _morningEndHour = endHour;
      changed = true;
    }
    
    if (autoStart != null && autoStart != _autoStartMonitoring) {
      _autoStartMonitoring = autoStart;
      changed = true;
    }
    
    if (backgroundMode != null && backgroundMode != _enableBackgroundMode) {
      _enableBackgroundMode = backgroundMode;
      changed = true;
    }
    
    if (changed) {
      await save();
      print('✅ Settings updated successfully');
    }
  }
  
  /// Get all configuration as map
  static Map<String, dynamic> getAllSettings() {
    return {
      'testMode': _isTestMode,
      'morningStartHour': _morningStartHour,
      'morningEndHour': _morningEndHour,
      'autoStartMonitoring': _autoStartMonitoring,
      'enableBackgroundMode': _enableBackgroundMode,
      'currentIdleThreshold': currentIdleThreshold.inMilliseconds,
      'locationUpdateInterval': locationUpdateInterval.inMilliseconds,
      'latitudeThreshold': latitudeThreshold,
      'longitudeThreshold': longitudeThreshold,
      'thresholdDistanceMeters': thresholdDistanceMeters,
      'isWithinMonitoringWindow': isWithinMonitoringWindow,
      'modeDescription': modeDescription,
      'timeWindowDescription': timeWindowDescription,
    };
  }
  
  /// Reset to default configuration
  static Future<void> resetToDefaults() async {
    await updateSettings(
      testMode: true,
      startHour: defaultMorningStartHour,
      endHour: defaultMorningEndHour,
      autoStart: true,
      backgroundMode: true,
    );
    
    print('✅ Configuration reset to defaults');
  }
  
  /// Validate configuration
  static bool validateConfiguration() {
    if (_morningStartHour < 0 || _morningStartHour > 23) return false;
    if (_morningEndHour < 0 || _morningEndHour > 23) return false;
    if (_morningStartHour >= _morningEndHour) return false;
    
    return true;
  }
  
  /// Get configuration summary for logging
  static String getConfigurationSummary() {
    return '''
Automatic Monitoring Configuration:
- Mode: $modeDescription
- Idle Threshold: ${currentIdleThreshold.inMinutes} minutes
- Time Window: $timeWindowDescription
- Location Updates: Every ${locationUpdateInterval.inMinutes} minute(s)
- GPS Threshold: ±$latitudeThreshold degrees (~${thresholdDistanceMeters}m)
- Auto Start: $_autoStartMonitoring
- Background Mode: $_enableBackgroundMode
- Currently Active: $isWithinMonitoringWindow
''';
  }
}