#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
from urllib.parse import urlparse, parse_qs
from datetime import datetime

PORT = 3001

class AbaiSpringsHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # API endpoints
        if path == '/api/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'status': 'OK',
                'message': 'Python server is running',
                'timestamp': datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/products':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = [
                {'_id': '1', 'name': 'Abai Water 500ml', 'brand': 'Abai', 'price': 50, 'stock': 150},
                {'_id': '2', 'name': 'Abai Water 1L', 'brand': 'Abai', 'price': 80, 'stock': 200},
                {'_id': '3', 'name': 'Sprinkle Water 500ml', 'brand': 'Sprinkle', 'price': 45, 'stock': 120}
            ]
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/outlets':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = [
                {'_id': '1', 'name': 'Nairobi Central', 'location': 'Nairobi CBD', 'phone': '+254 700 123 456', 'status': 'Active'},
                {'_id': '2', 'name': 'Mombasa Branch', 'location': 'Mombasa City', 'phone': '+254 700 789 012', 'status': 'Active'}
            ]
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/orders':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = [
                {'_id': '1', 'orderNumber': 'ORD001', 'customer': 'John Doe', 'total': 100, 'status': 'Delivered'},
                {'_id': '2', 'orderNumber': 'ORD002', 'customer': 'Jane Smith', 'total': 45, 'status': 'Processing'}
            ]
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/auth/users':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = [
                {'_id': '1', 'name': 'John Doe', 'email': 'john@example.com', 'phone': '+254 700 123 456'},
                {'_id': '2', 'name': 'Jane Smith', 'email': 'jane@example.com', 'phone': '+254 700 789 012'}
            ]
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/stock-alerts/statistics':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'activeAlerts': 5,
                'alertsSentToday': 12,
                'monitoringActive': True,
                'totalPredictions': 8
            }
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/api/stock-alerts':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = []
            self.wfile.write(json.dumps(response).encode())
            return
            
        elif path == '/admin-fixed':
            # Serve the admin dashboard
            self.path = '/admin-dashboard-fixed.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
            
        else:
            # Serve static files
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        if path in ['/api/stock-alerts/monitoring/start', '/api/stock-alerts/monitoring/stop']:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            action = 'started' if 'start' in path else 'stopped'
            response = {'success': True, 'message': f'Monitoring {action}'}
            self.wfile.write(json.dumps(response).encode())
            return
        else:
            self.send_response(404)
            self.end_headers()
            return
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# Change to parent directory to serve frontend files
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

print(f'🚀 Starting Python server on port {PORT}...')
print(f'📱 API available at http://localhost:{PORT}/api')
print(f'🔧 Admin Dashboard available at http://localhost:{PORT}/admin-fixed')

with socketserver.TCPServer(("", PORT), AbaiSpringsHandler) as httpd:
    print(f"✅ Server running at http://localhost:{PORT}")
    httpd.serve_forever()











