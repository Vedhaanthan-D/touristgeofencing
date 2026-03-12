import 'package:flutter/material.dart';

/// Global context manager for automatic operations
/// Provides access to BuildContext for notifications and dialogs
class AutomaticGlobalContext {
  static final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  static BuildContext? _currentContext;
  
  /// Get the global navigator key
  static GlobalKey<NavigatorState> get navigatorKey => _navigatorKey;
  
  /// Set the current context (called by the main app)
  static void setCurrentContext(BuildContext context) {
    _currentContext = context;
  }
  
  /// Get the current context for automatic operations
  static BuildContext? getCurrentContext() {
    // Try navigator key first
    final navigatorContext = _navigatorKey.currentContext;
    if (navigatorContext != null) {
      return navigatorContext;
    }
    
    // Fall back to stored context
    if (_currentContext != null && _currentContext!.mounted) {
      return _currentContext;
    }
    
    return null;
  }
  
  /// Check if context is available
  static bool get hasContext => getCurrentContext() != null;
  
  /// Get the overlay context for showing dialogs
  static BuildContext? getOverlayContext() {
    final context = getCurrentContext();
    if (context != null) {
      return Overlay.of(context).context;
    }
    return null;
  }
  
  /// Get the scaffold messenger for showing snackbars
  static ScaffoldMessengerState? getScaffoldMessenger() {
    final context = getCurrentContext();
    if (context != null) {
      try {
        return ScaffoldMessenger.of(context);
      } catch (e) {
        print('❌ No ScaffoldMessenger found: $e');
      }
    }
    return null;
  }
  
  /// Show automatic snackbar message
  static void showAutomaticMessage(String message, {Color? backgroundColor}) {
    try {
      final messenger = getScaffoldMessenger();
      if (messenger != null) {
        messenger.clearSnackBars();
        messenger.showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: backgroundColor ?? Colors.orange,
            duration: const Duration(seconds: 3),
            action: SnackBarAction(
              label: 'Dismiss',
              onPressed: () => messenger.clearSnackBars(),
              textColor: Colors.white,
            ),
          ),
        );
        print('✅ Automatic message shown: $message');
      } else {
        print('⚠️ No messenger available for automatic message: $message');
      }
    } catch (e) {
      print('❌ Failed to show automatic message: $e');
    }
  }
  
  /// Clear the context when no longer needed
  static void clearContext() {
    _currentContext = null;
  }
}