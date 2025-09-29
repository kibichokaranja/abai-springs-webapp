#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
from urllib.parse import urlparse, parse_qs

PORT = 3004

class StaffPortalHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        print(f"📄 GET request: {path}")
        
        # Route handling
        if path == '/staff-login':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Read and serve staff-login.html
            try:
                with open('staff-login.html', 'rb') as f:
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.wfile.write(b'<h1>Staff Login Page Not Found</h1>')
                
        elif path == '/owner-dashboard':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Read and serve owner-dashboard.html
            try:
                with open('owner-dashboard.html', 'rb') as f:
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.wfile.write(b'<h1>Owner Dashboard Not Found</h1>')
                
        elif path == '/api/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "status": "OK",
                "message": "Staff Portal Server is running",
                "endpoints": {
                    "staffLogin": "/staff-login",
                    "ownerDashboard": "/owner-dashboard",
                    "apiHealth": "/api/health"
                }
            }
            self.wfile.write(json.dumps(response).encode())
            
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        # Parse the URL
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        print(f"🔐 POST request: {path}")
        
        if path == '/api/auth/staff-login':
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                email = data.get('email', '')
                password = data.get('password', '')
                role = data.get('role', '')
                
                print(f"Login attempt: {email} / {role}")
                
                # Mock authentication
                if email == 'admin@abaisprings.com' and password == 'password123' and role == 'owner':
                    response = {
                        "success": True,
                        "message": "Staff login successful",
                        "token": "mock-jwt-token",
                        "user": {
                            "id": "1",
                            "name": "Business Owner",
                            "email": "admin@abaisprings.com",
                            "role": "owner"
                        }
                    }
                    status_code = 200
                else:
                    response = {
                        "success": False,
                        "message": "Invalid credentials"
                    }
                    status_code = 401
                
                self.send_response(status_code)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                self.wfile.write(json.dumps(response).encode())
                
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
                
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    print(f"🚀 Starting Staff Portal Server on port {PORT}...")
    print(f"📄 Staff Login: http://localhost:{PORT}/staff-login")
    print(f"👑 Owner Dashboard: http://localhost:{PORT}/owner-dashboard")
    print(f"🔍 Health Check: http://localhost:{PORT}/api/health")
    print("")
    print("🔐 Test Credentials:")
    print("Owner: admin@abaisprings.com / password123")
    print("")
    print("Press Ctrl+C to stop the server")
    
    with socketserver.TCPServer(("", PORT), StaffPortalHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n�� Server stopped.")
