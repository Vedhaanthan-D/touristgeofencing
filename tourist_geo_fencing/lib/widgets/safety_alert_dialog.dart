import 'package:flutter/material.dart';
import '../models/safety_alert.dart';
import '../utils/location_utils.dart';

class SafetyAlertDialog extends StatelessWidget {
  final SafetyAlert alert;
  final VoidCallback? onDismiss;
  final VoidCallback? onViewDetails;

  const SafetyAlertDialog({
    Key? key,
    required this.alert,
    this.onDismiss,
    this.onViewDetails,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final riskLevel = _getRiskLevel();
    final riskColor = _getRiskColor(riskLevel);

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(
            Icons.warning,
            color: riskColor,
            size: 32,
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Safety Alert Triggered',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Risk Level Indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: riskColor.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: riskColor, width: 1),
              ),
              child: Text(
                'Risk Level: $riskLevel',
                style: TextStyle(
                  color: riskColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Alert Details
            _buildInfoRow(
              Icons.location_on,
              'Location',
              LocationUtils.formatLocation(alert.latitude, alert.longitude),
            ),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.access_time,
              'Idle Duration',
              _formatDuration(alert.idleDuration),
            ),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.schedule,
              'Started At',
              _formatDateTime(alert.idleStartTimestamp),
            ),

            // Gemini Analysis Summary
            if (alert.geminiAnalysis != null) ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              Text(
                'AI Analysis:',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 8),
              _buildGeminiSummary(),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(context).pop();
            onDismiss?.call();
          },
          child: const Text('Dismiss'),
        ),
        if (onViewDetails != null)
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              onViewDetails?.call();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: riskColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('View Details'),
          ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey[600]),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGeminiSummary() {
    final analysis = alert.geminiAnalysis;
    if (analysis == null) return const SizedBox.shrink();

    final summary = analysis['summary'] ?? 'Analysis completed';
    final recommendations = analysis['recommendations'] as List<dynamic>? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          summary,
          style: const TextStyle(fontSize: 13),
        ),
        if (recommendations.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            'Recommendations:',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: Colors.grey[700],
            ),
          ),
          const SizedBox(height: 4),
          ...recommendations.take(2).map((rec) => Padding(
            padding: const EdgeInsets.only(left: 8, top: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '• ',
                  style: TextStyle(color: Colors.grey[600]),
                ),
                Expanded(
                  child: Text(
                    rec.toString(),
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          )),
        ],
      ],
    );
  }

  String _getRiskLevel() {
    final analysis = alert.geminiAnalysis;
    if (analysis != null && analysis['riskLevel'] != null) {
      return analysis['riskLevel'].toString();
    }
    // Fallback based on duration
    if (alert.idleDuration.inHours >= 6) return 'HIGH';
    if (alert.idleDuration.inHours >= 3) return 'MODERATE';
    return 'LOW';
  }

  Color _getRiskColor(String riskLevel) {
    switch (riskLevel.toUpperCase()) {
      case 'CRITICAL':
        return Colors.red[800]!;
      case 'HIGH':
        return Colors.red;
      case 'MODERATE':
        return Colors.orange;
      case 'LOW':
      default:
        return Colors.yellow[700]!;
    }
  }

  String _formatDuration(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h ${duration.inMinutes % 60}m';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inMinutes}m';
    }
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.day}/${dateTime.month}/${dateTime.year} ${dateTime.hour}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}