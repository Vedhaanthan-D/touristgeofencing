import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/safety_alert.dart';
import '../services/safety_alert_database_service.dart';
import '../services/gemini_api_service.dart';

/// Automatic alert processor that handles safety alert creation,
/// database storage, and Gemini API enrichment without user intervention
class AutomaticAlertProcessor {
  // Services
  final SafetyAlertDatabaseService _database = SafetyAlertDatabaseService();
  final GeminiApiService _geminiApi = GeminiApiService();
  
  // State management
  bool _isInitialized = false;
  String _currentUserId = 'auto_user';
  
  // Automatic callbacks
  Function(SafetyAlert)? onAlertProcessed;
  Function(String)? onError;
  
  // Retry configuration
  static const int _maxRetries = 3;
  static const Duration _baseRetryDelay = Duration(seconds: 5);
  
  /// Initialize automatic alert processor
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    print('🔧 Initializing automatic alert processor...');
    
    _isInitialized = true;
    print('✅ Automatic alert processor initialized');
  }
  
  /// Process safety alert automatically with complete workflow
  Future<void> processAlertAutomatically(SafetyAlert alert) async {
    if (!_isInitialized) {
      await initialize();
    }
    
    try {
      print('🔄 Starting automatic alert processing...');
      
      // Step 1: Store initial alert in database
      final alertId = await _storeInitialAlertAutomatically(alert);
      
      // Step 2: Enrich with Gemini API analysis
      final enrichedAlert = await _enrichWithGeminiAutomatically(alert, alertId);
      
      // Step 3: Update database with enriched data
      await _updateAlertWithAnalysisAutomatically(alertId, enrichedAlert);
      
      // Step 4: Trigger completion callback
      onAlertProcessed?.call(enrichedAlert);
      
      print('✅ Automatic alert processing completed successfully');
      
    } catch (e) {
      print('❌ Error in automatic alert processing: $e');
      await _retryAlertProcessing(alert);
    }
  }
  
  /// Store initial alert in database automatically
  Future<String> _storeInitialAlertAutomatically(SafetyAlert alert) async {
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('💾 Storing initial alert (attempt $attempt/$_maxRetries)...');
        
        final alertId = await _database.createSafetyAlert(alert);
        
        print('✅ Alert stored with ID: $alertId');
        return alertId;
        
      } catch (e) {
        print('❌ Database storage attempt $attempt failed: $e');
        
        if (attempt == _maxRetries) {
          onError?.call('Failed to store alert after $attempt attempts: $e');
          rethrow;
        }
        
        // Exponential backoff
        await Future.delayed(_baseRetryDelay * attempt);
      }
    }
    
    throw Exception('Failed to store alert after $_maxRetries attempts');
  }
  
  /// Enrich alert with Gemini API analysis automatically
  Future<SafetyAlert> _enrichWithGeminiAutomatically(SafetyAlert alert, String alertId) async {
    Map<String, dynamic>? geminiAnalysis;
    
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('🤖 Enriching with Gemini API (attempt $attempt/$_maxRetries)...');
        
        geminiAnalysis = await _geminiApi.analyzeLocationSafety(alert);
        
        if (geminiAnalysis != null) {
          print('✅ Gemini analysis completed successfully');
          break;
        } else {
          print('⚠️ Gemini API returned null response');
        }
        
      } catch (e) {
        print('❌ Gemini API attempt $attempt failed: $e');
        
        if (attempt < _maxRetries) {
          // Exponential backoff for API calls
          await Future.delayed(_baseRetryDelay * attempt);
        }
      }
    }
    
    // Create enriched alert (with or without Gemini data)
    final enrichedAlert = SafetyAlert(
      id: alertId,
      userId: alert.userId,
      dtid: alert.dtid,
      latitude: alert.latitude,
      longitude: alert.longitude,
      idleStartTimestamp: alert.idleStartTimestamp,
      idleDuration: alert.idleDuration,
      geminiAnalysis: geminiAnalysis,
      createdAt: alert.createdAt,
    );
    
    return enrichedAlert;
  }
  
  /// Update alert with analysis data automatically
  Future<void> _updateAlertWithAnalysisAutomatically(String alertId, SafetyAlert enrichedAlert) async {
    if (enrichedAlert.geminiAnalysis == null) {
      print('⚠️ No Gemini analysis to update, skipping database update');
      return;
    }
    
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('📝 Updating alert with analysis (attempt $attempt/$_maxRetries)...');
        
        await _database.updateSafetyAlert(alertId, {
          'geminiAnalysis': enrichedAlert.geminiAnalysis,
          'updatedAt': DateTime.now().toIso8601String(),
        });
        
        print('✅ Alert updated with Gemini analysis');
        return;
        
      } catch (e) {
        print('❌ Database update attempt $attempt failed: $e');
        
        if (attempt == _maxRetries) {
          onError?.call('Failed to update alert with analysis: $e');
          // Don't throw - we still want to proceed with notifications
          return;
        }
        
        await Future.delayed(_baseRetryDelay * attempt);
      }
    }
  }
  
  /// Retry entire alert processing workflow
  Future<void> _retryAlertProcessing(SafetyAlert alert) async {
    for (int attempt = 1; attempt <= _maxRetries; attempt++) {
      try {
        print('🔄 Retrying complete alert processing (attempt $attempt/$_maxRetries)...');
        
        await Future.delayed(_baseRetryDelay * attempt);
        await processAlertAutomatically(alert);
        
        print('✅ Alert processing retry successful');
        return;
        
      } catch (e) {
        print('❌ Complete retry attempt $attempt failed: $e');
      }
    }
    
    print('🚫 All retry attempts failed for alert processing');
    onError?.call('Critical: Alert processing completely failed after all retries');
  }
  
  /// Quick location safety check (lighter API call)
  Future<Map<String, dynamic>?> performQuickSafetyCheck(double latitude, double longitude) async {
    try {
      print('🔍 Performing quick safety check...');
      
      final result = await _geminiApi.quickLocationCheck(latitude, longitude);
      
      if (result != null) {
        print('✅ Quick safety check completed');
        return result;
      } else {
        print('⚠️ Quick safety check returned no data');
        return null;
      }
      
    } catch (e) {
      print('❌ Quick safety check failed: $e');
      onError?.call('Quick safety check failed: $e');
      return null;
    }
  }
  
  /// Create emergency alert (faster processing)
  Future<SafetyAlert?> createEmergencyAlert(SafetyAlert alert) async {
    try {
      print('🚨 Creating emergency alert with expedited processing...');
      
      // Store immediately with high priority
      final alertId = await _database.createSafetyAlert(alert);
      
      // Quick Gemini analysis (shorter timeout)
      Map<String, dynamic>? quickAnalysis;
      try {
        quickAnalysis = await _performQuickGeminiAnalysis(alert);
      } catch (e) {
        print('⚠️ Quick Gemini analysis failed, proceeding without: $e');
      }
      
      // Update if we got analysis
      if (quickAnalysis != null) {
        await _database.updateSafetyAlert(alertId, {
          'geminiAnalysis': quickAnalysis,
          'priority': 'EMERGENCY',
        });
      }
      
      final emergencyAlert = SafetyAlert(
        id: alertId,
        userId: alert.userId,
        dtid: alert.dtid,
        latitude: alert.latitude,
        longitude: alert.longitude,
        idleStartTimestamp: alert.idleStartTimestamp,
        idleDuration: alert.idleDuration,
        geminiAnalysis: quickAnalysis,
        createdAt: alert.createdAt,
      );
      
      print('✅ Emergency alert created successfully');
      return emergencyAlert;
      
    } catch (e) {
      print('❌ Emergency alert creation failed: $e');
      onError?.call('Critical: Emergency alert creation failed: $e');
      return null;
    }
  }
  
  /// Perform quick Gemini analysis with shorter timeout
  Future<Map<String, dynamic>?> _performQuickGeminiAnalysis(SafetyAlert alert) async {
    try {
      // Create a simplified prompt for faster processing
      final quickPrompt = '''
        Quick safety assessment for emergency alert:
        Location: ${alert.latitude}, ${alert.longitude}
        Idle Duration: ${alert.idleDuration.inMinutes} minutes
        
        Provide immediate risk level (LOW/MODERATE/HIGH/CRITICAL) and 2-3 urgent recommendations only.
        Format: {"riskLevel": "...", "urgentRecommendations": ["...", "...", "..."]}
      ''';
      
      final response = await http.post(
        Uri.parse('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCwoQOFAABTyliuKum9Ze3VbYXwG8H85Hc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'contents': [{'parts': [{'text': quickPrompt}]}],
          'generationConfig': {'maxOutputTokens': 200, 'temperature': 0.1},
        }),
      ).timeout(const Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final content = data['candidates']?[0]?['content']?['parts']?[0]?['text'];
        
        if (content != null) {
          // Try to parse JSON from response
          final jsonMatch = RegExp(r'\{.*\}', dotAll: true).firstMatch(content);
          if (jsonMatch != null) {
            return jsonDecode(jsonMatch.group(0)!);
          }
        }
      }
      
      return null;
      
    } catch (e) {
      print('❌ Quick Gemini analysis failed: $e');
      return null;
    }
  }
  
  /// Set user ID for automatic processing
  void setUserId(String userId) {
    _currentUserId = userId;
    print('👤 Alert processor user ID set to: $userId');
  }
  
  /// Get processing statistics
  Map<String, dynamic> getProcessingStats() {
    return {
      'isInitialized': _isInitialized,
      'currentUserId': _currentUserId,
      'maxRetries': _maxRetries,
      'baseRetryDelay': _baseRetryDelay.inSeconds,
    };
  }
  
  /// Dispose resources
  void dispose() {
    _isInitialized = false;
    print('🗑️ Automatic alert processor disposed');
  }
}