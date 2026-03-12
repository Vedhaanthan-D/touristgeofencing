import 'package:firebase_auth/firebase_auth.dart';
import 'current_user_service.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<User?> signInWithEmailAndDtid({required String email, required String dtid}) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(email: email, password: dtid);
      final user = credential.user;
      if (user != null) {
        await CurrentUserService().setFromAuth(user, dtid);
      }
      return user;
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          throw 'No user found for that email.';
        case 'wrong-password':
          throw 'Wrong DTID provided for that user.';
        case 'invalid-email':
          throw 'The email address is badly formatted.';
        case 'user-disabled':
          throw 'This user account has been disabled.';
        case 'too-many-requests':
          throw 'Too many failed login attempts. Please try again later.';
        case 'network-request-failed':
          throw 'Network error. Please check your internet connection.';
        default:
          throw 'Login failed: ${e.message ?? 'Unknown error'}';
      }
    } catch (e) {
      throw 'Login failed: $e';
    }
  }

  Future<void> signOut() async {
    try {
      await _auth.signOut();
      await CurrentUserService().clear();
    } catch (e) {
      throw 'Sign out failed: $e';
    }
  }
}
