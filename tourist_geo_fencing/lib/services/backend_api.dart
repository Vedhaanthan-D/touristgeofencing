import 'package:http/http.dart' as http;
import 'dart:convert';

class BackendApi {
  // IMPORTANT: Set this to your backend host. Mobile apps cannot reach "localhost" of your PC.
  // Example for Android emulator: use 10.0.2.2. For a device on same LAN, use your PC IP.
  static const String baseUrl = String.fromEnvironment(
    'BACKEND_BASE_URL',
    defaultValue: 'http://10.126.233.26:3000', // Change if needed
  );

  static Future<bool> isTouristActive({
    required String email,
    required String dtid,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/api/is-active');
      final resp = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'dtid': dtid}),
      ).timeout(const Duration(seconds: 10));

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        return (data['isActive'] == true);
      } else if (resp.statusCode == 404) {
        throw 'Tourist not found or inactive';
      } else {
        throw 'Server error: ${resp.statusCode}';
      }
    } catch (e) {
      // If backend is unreachable, allow authentication to proceed
      // You might want to change this behavior based on your requirements
      print('Backend check failed: $e');
      return true; // Allow login even if backend check fails
    }
  }
}
