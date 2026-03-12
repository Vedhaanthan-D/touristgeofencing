import 'dart:math';
import '../models/safety_alert.dart';
import '../services/location_monitor_config.dart';

class LocationUtils {
  /// Check if two locations are within the defined threshold range
  static bool isWithinRange(
    double lat1, double lng1, 
    double lat2, double lng2
  ) {
    final latDiff = (lat1 - lat2).abs();
    final lngDiff = (lng1 - lng2).abs();
    
    return latDiff <= LocationMonitorConfig.latitudeThreshold && 
           lngDiff <= LocationMonitorConfig.longitudeThreshold;
  }

  /// Check if a location is within range of a reference location
  static bool isLocationWithinRange(UserLocation current, UserLocation reference) {
    return isWithinRange(
      current.latitude, current.longitude,
      reference.latitude, reference.longitude
    );
  }

  /// Calculate distance between two points in meters using Haversine formula
  static double calculateDistance(
    double lat1, double lng1, 
    double lat2, double lng2
  ) {
    const double earthRadius = 6371000; // meters
    
    final double dLatRad = _toRadians(lat2 - lat1);
    final double dLngRad = _toRadians(lng2 - lng1);
    final double lat1Rad = _toRadians(lat1);
    final double lat2Rad = _toRadians(lat2);
    
    final double a = sin(dLatRad / 2) * sin(dLatRad / 2) +
        cos(lat1Rad) * cos(lat2Rad) * sin(dLngRad / 2) * sin(dLngRad / 2);
    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    
    return earthRadius * c;
  }

  /// Convert degrees to radians
  static double _toRadians(double degrees) => degrees * (pi / 180.0);

  /// Check if current time is within morning monitoring window
  static bool isWithinMonitoringWindow() {
    final now = DateTime.now();
    final hour = now.hour;
    
    return hour >= LocationMonitorConfig.morningStartHour && 
           hour <= LocationMonitorConfig.morningEndHour;
  }

  /// Format location for display
  static String formatLocation(double latitude, double longitude) {
    return '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
  }

  /// Get threshold distance in meters for reference
  static double getThresholdDistanceMeters() {
    // Approximate conversion: 0.0045 degrees ≈ 500 meters
    return calculateDistance(
      0.0, 0.0,
      LocationMonitorConfig.latitudeThreshold,
      LocationMonitorConfig.longitudeThreshold
    );
  }

  /// Validate if location data is reasonable
  static bool isValidLocation(double latitude, double longitude) {
    return latitude >= -90.0 && latitude <= 90.0 &&
           longitude >= -180.0 && longitude <= 180.0;
  }

  /// Create a bounding box around a location with the threshold
  static Map<String, double> createBoundingBox(double latitude, double longitude) {
    return {
      'minLat': latitude - LocationMonitorConfig.latitudeThreshold,
      'maxLat': latitude + LocationMonitorConfig.latitudeThreshold,
      'minLng': longitude - LocationMonitorConfig.longitudeThreshold,
      'maxLng': longitude + LocationMonitorConfig.longitudeThreshold,
    };
  }
}