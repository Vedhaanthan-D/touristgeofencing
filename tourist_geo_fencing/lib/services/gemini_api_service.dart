import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/safety_alert.dart';
import '../utils/location_utils.dart';

class GeminiApiService {
  static const String baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  static const String apiKey = 'AIzaSyCwoQOFAABTyliuKum9Ze3VbYXwG8H85Hc';

  /// Analyze location and safety alert context using Gemini API
  Future<Map<String, dynamic>?> analyzeLocationSafety(SafetyAlert alert) async {
    try {
      final locationDescription = await _getLocationDescription(
        alert.latitude, 
        alert.longitude
      );

      final prompt = _buildSafetyAnalysisPrompt(alert, locationDescription);
      
      final response = await _callGeminiApi(prompt);
      if (response != null) {
        return {
          'geminiAnalysis': response,
          'locationDescription': locationDescription,
          'analysisTimestamp': DateTime.now().toIso8601String(),
          'riskLevel': _extractRiskLevel(response),
          'recommendations': _extractRecommendations(response),
        };
      }
    } catch (e) {
      print('Error analyzing location safety with Gemini: $e');
    }
    return null;
  }

  /// Get location description and nearby landmarks
  Future<String> _getLocationDescription(double latitude, double longitude) async {
    // This would typically use a reverse geocoding service
    // For now, we'll create a basic description
    return 'Location: ${LocationUtils.formatLocation(latitude, longitude)}';
  }

  /// Build comprehensive prompt for Gemini API
  String _buildSafetyAnalysisPrompt(SafetyAlert alert, String locationDescription) {
    return '''
Analyze this safety alert situation and provide insights:

ALERT DETAILS:
- Location: ${LocationUtils.formatLocation(alert.latitude, alert.longitude)}
- Idle Duration: ${_formatDuration(alert.idleDuration)}
- Time of Alert: ${alert.createdAt.toString()}
- Alert Triggered At: ${alert.idleStartTimestamp.toString()}

LOCATION CONTEXT:
$locationDescription

ANALYSIS REQUIRED:
1. Assess the safety risk level (LOW/MODERATE/HIGH/CRITICAL)
2. Identify potential reasons for extended idle time at this location
3. Evaluate location safety characteristics
4. Provide specific safety recommendations
5. Suggest immediate actions if needed
6. Consider time of day and duration factors

Please provide a structured JSON response with:
{
  "riskLevel": "LOW|MODERATE|HIGH|CRITICAL",
  "riskFactors": ["list of identified risk factors"],
  "locationAnalysis": {
    "safetyScore": 1-10,
    "locationType": "description",
    "nearbyLandmarks": ["landmarks if known"],
    "timeOfDayRisk": "assessment"
  },
  "recommendations": [
    "specific actionable recommendations"
  ],
  "immediateActions": [
    "urgent actions if high risk"
  ],
  "summary": "brief overall assessment"
}

Be thorough but concise. Focus on practical safety insights.
''';
  }

  /// Call Gemini API with the generated prompt
  Future<String?> _callGeminiApi(String prompt) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl?key=$apiKey'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'contents': [
            {
              'parts': [
                {'text': prompt}
              ]
            }
          ],
          'generationConfig': {
            'temperature': 0.3,
            'topK': 40,
            'topP': 0.95,
            'maxOutputTokens': 1024,
          },
          'safetySettings': [
            {
              'category': 'HARM_CATEGORY_HARASSMENT',
              'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              'category': 'HARM_CATEGORY_HATE_SPEECH',
              'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
              'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['candidates'] != null && data['candidates'].isNotEmpty) {
          final content = data['candidates'][0]['content']['parts'][0]['text'];
          return content;
        }
      } else {
        print('Gemini API error: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('Error calling Gemini API: $e');
    }
    return null;
  }

  /// Extract risk level from Gemini response
  String _extractRiskLevel(String response) {
    try {
      final jsonMatch = RegExp(r'\{.*\}', dotAll: true).firstMatch(response);
      if (jsonMatch != null) {
        final jsonData = jsonDecode(jsonMatch.group(0)!);
        return jsonData['riskLevel'] ?? 'MODERATE';
      }
    } catch (e) {
      print('Error extracting risk level: $e');
    }
    
    // Fallback extraction
    if (response.toUpperCase().contains('CRITICAL')) return 'CRITICAL';
    if (response.toUpperCase().contains('HIGH')) return 'HIGH';
    if (response.toUpperCase().contains('MODERATE')) return 'MODERATE';
    return 'LOW';
  }

  /// Extract recommendations from Gemini response
  List<String> _extractRecommendations(String response) {
    try {
      final jsonMatch = RegExp(r'\{.*\}', dotAll: true).firstMatch(response);
      if (jsonMatch != null) {
        final jsonData = jsonDecode(jsonMatch.group(0)!);
        final recommendations = jsonData['recommendations'];
        if (recommendations is List) {
          return recommendations.cast<String>();
        }
      }
    } catch (e) {
      print('Error extracting recommendations: $e');
    }
    
    // Fallback: extract bullet points
    final lines = response.split('\n');
    final recommendations = <String>[];
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        recommendations.add(trimmed.substring(1).trim());
      }
    }
    return recommendations;
  }

  /// Format duration for display
  String _formatDuration(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays} day(s), ${duration.inHours % 24} hour(s)';
    } else if (duration.inHours > 0) {
      return '${duration.inHours} hour(s), ${duration.inMinutes % 60} minute(s)';
    } else {
      return '${duration.inMinutes} minute(s)';
    }
  }

  /// Quick safety check for a location
  Future<Map<String, dynamic>?> quickLocationCheck(double latitude, double longitude) async {
    final prompt = '''
Provide a quick safety assessment for this location: ${LocationUtils.formatLocation(latitude, longitude)}

Consider:
- General safety level
- Time of day appropriateness
- Common safety concerns
- Basic recommendations

Respond in JSON format:
{
  "safetyScore": 1-10,
  "quickAssessment": "brief safety summary",
  "mainConcerns": ["primary safety concerns"],
  "basicRecommendations": ["2-3 basic safety tips"]
}
''';

    final response = await _callGeminiApi(prompt);
    if (response != null) {
      try {
        final jsonMatch = RegExp(r'\{.*\}', dotAll: true).firstMatch(response);
        if (jsonMatch != null) {
          return jsonDecode(jsonMatch.group(0)!);
        }
      } catch (e) {
        print('Error parsing quick location check: $e');
      }
    }
    return null;
  }
}