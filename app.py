from flask import Flask, request, jsonify, render_template, render_template_string, Response
from flask_socketio import SocketIO, emit
from datetime import datetime
import os
import pdfkit
from urllib.parse import urlparse
import json

app = Flask(__name__)
socketio = SocketIO(app)

# List to store scans data
scans_data = []
# Scanned being displayed
active_scan = 0

UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/receive_data', methods=['POST'])
def receive_data():
    global scans_data, active_scan

    # Images
    if 'map_image' not in request.files or 'rooms_image' not in request.files:
        return jsonify({"message": "No image file received"}), 400
    
    map_image = request.files['map_image']
    walls_image = request.files['rooms_image']
    if map_image.filename == '' or walls_image.filename == '':
        return jsonify({"message": "No selected file"}), 400

    scan_number = request.form.get('scan_number', 0)
    wifi_name = request.form.get('wifi_name', "--")

    # Strength values
    wifi_max_strength = request.form.get('wifi_max_strength', 0)
    wifi_min_strength = request.form.get('wifi_min_strength', 0)
    wifi_avg_strength = request.form.get('wifi_avg_strength', 0)

    # Speed values
    wifi_max_speed = request.form.get('wifi_max_speed', 0)
    wifi_min_speed = request.form.get('wifi_min_speed', 0)
    wifi_avg_speed = request.form.get('wifi_avg_speed', 0)

    # Save images with unique names
    map_image_filename = f"map_{scan_number}.png"
    walls_image_filename = f"walls_{scan_number}.png"

    if map_image and walls_image:
        # Map
        map_image.save(os.path.join(app.config['UPLOAD_FOLDER'], map_image_filename))
        map_img_path = os.path.join(app.config['UPLOAD_FOLDER'], map_image_filename)
        # Walls
        walls_image.save(os.path.join(app.config['UPLOAD_FOLDER'], walls_image_filename))
        walls_img_path = os.path.join(app.config['UPLOAD_FOLDER'], walls_image_filename)

    # Matrix
    wifi_strength_matrix = json.loads(request.form.get('wifi_strength_matrix', "[[0,0],[0,0]]"))
    wifi_speed_matrix = json.loads(request.form.get('wifi_speed_matrix', "[[0,0],[0,0]]"))

    # Check if the scan number already exists
    existing_scan = next((scan for scan in scans_data if scan['scan_number'] == scan_number), None)
    if existing_scan:
        # Update the existing scan
        existing_scan.update({
            "wifi_name": wifi_name,
            "wifi_max_strength": wifi_max_strength,
            "wifi_min_strength": wifi_min_strength,
            "wifi_avg_strength": wifi_avg_strength,
            "wifi_max_speed": wifi_max_speed,
            "wifi_min_speed": wifi_min_speed,
            "wifi_avg_speed": wifi_avg_speed,
            "map_img_path": map_img_path,
            "walls_img_path": walls_img_path,
            "wifi_strength_matrix": wifi_strength_matrix,
            "wifi_speed_matrix": wifi_speed_matrix
        })

    else:
        active_scan = len(scans_data)
        
        # Get current timestamp
        current_time = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

        # Add new scan
        scans_data.append({
            "scan_number": scan_number,
            "wifi_name": wifi_name,
            "wifi_max_strength": wifi_max_strength,
            "wifi_min_strength": wifi_min_strength,
            "wifi_avg_strength": wifi_avg_strength,
            "wifi_max_speed": wifi_max_speed,
            "wifi_min_speed": wifi_min_speed,
            "wifi_avg_speed": wifi_avg_speed,
            "map_img_path": map_img_path,
            "walls_img_path": walls_img_path,
            "wifi_strength_matrix": wifi_strength_matrix,
            "wifi_speed_matrix": wifi_speed_matrix,
            "scan_time": current_time
        })

    # Emit an update to all connected clients
    update_data = [scans_data, active_scan]
    socketio.emit('update_data', update_data)

    return jsonify({"message": "Data received successfully"}), 200


@app.route('/')
def home():
    return render_template("index.html", scans_data=scans_data, active_scan=active_scan)


@app.route('/render_matrix', methods=['POST'])
def render_matrix():
    matrix_data = json.loads(request.form.get('matrix_data'))
    unit = request.form.get('unit')
    min_value = request.form.get('min_value')
    return jsonify(html=render_template_string("{% from 'macros.html' import matrix %}{{ matrix(matrix_data, unit, min_value) }}", matrix_data=matrix_data, unit=unit, min_value=min_value))


@app.route("/update_active_scan", methods=['POST'])
def update_active_scan():
    try:
        global active_scan
        active_scan = int(request.form.get('active_scan'))

        # Update page
        update_data = [scans_data, active_scan]
        socketio.emit('update_data', update_data)
        
        return jsonify({"message": "Updated active scan successfully"}), 200
    
    except:
        return jsonify({"message": "Couldn't update active scan"}), 400


def route_download(data):
    parsed_url = urlparse(request.url)
    root = parsed_url.scheme + "://" + parsed_url.netloc

    # Get current timestamp
    current_time = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    timestamp_filename = datetime.now().strftime("%d%m%Y_%H%M%S")

    if not scans_data:
        return jsonify({"message": "No data available to generate PDF"}), 400

    out = render_template("pdf.html",
        scans_data=data,
        root=root,
        current_time=current_time
    )
    
    # Specify the path to the wkhtmltopdf executable
    path_to_wkhtmltopdf = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
    config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
    
    # Generate PDF from HTML string
    pdf = pdfkit.from_string(out, 'static/downloads/output.pdf', configuration=config)
    
    # Download the PDF
    with open("static/downloads/output.pdf", "rb") as f:
        pdf = f.read()

    filename = f"{data[0]['wifi_name']}_{timestamp_filename}.pdf"
    headers = {"Content-Disposition": f"attachment;filename={filename}"}
    return Response(pdf, mimetype="application/pdf", headers=headers)


@app.route("/download")
def download():
    return route_download([scans_data[active_scan]])

@app.route("/download_all")
def download_all():
    return route_download(scans_data)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)