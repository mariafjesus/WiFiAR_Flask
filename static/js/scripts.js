/* BUTTONS INTERACTIONS */
// Toggle button that shows or hides walls
function showWalls() {
    var checkBox = document.getElementById('show_walls');
    var img = document.getElementById("walls_image");
    if (checkBox.checked == true) {
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }
}

// Listen for changes in the Radio Buttons
document.addEventListener('DOMContentLoaded', function() {
    /* Images Radio buttons */
    const radioButtons = document.querySelectorAll('input[name="image_select"]');
    const images = {
        strength: document.getElementById('strength_image'),
        speed: document.getElementById('speed_image'),
        all: document.getElementById('all_image')
    };
    const labels = {
        strength: document.getElementById('strength_label'),
        speed: document.getElementById('speed_label'),
        all: document.getElementById('all_label')
    }
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            for (const key in images) {
                images[key].classList.remove('active');
            }
            images[this.value].classList.add('active');
            for (const key in labels) {
                labels[key].classList.remove('active');
            }
            labels[this.value].classList.add('active');
        });
    });
    
    attachScanRadioButtonListeners();
});

function attachScanRadioButtonListeners() {
    // Radio buttons for scan select
    const scanRadioButtons = document.querySelectorAll('input[name="scans_select"]');
    scanRadioButtons.forEach(scan_radio => {
        scan_radio.addEventListener('change', function() {
            scanRadioButtons.forEach(rb => {
                document.getElementById(`scan_label_${rb.value}`).classList.remove('active');
            });
            document.getElementById(`scan_label_${this.value}`).classList.add('active');
            updateActiveScan(this.value - 1);
        });
    });
}

function updateActiveScan(active_scan) {
    $.ajax({
        type: 'POST',
        url: '/update_active_scan',
        data: {
            active_scan: active_scan,
        },
        error: function(error) {
            console.log('Error:', error);
        }
    });
}

function savePDF() {    
    // Create a temporary link element
    var link = document.createElement('a');
    link.href = '/download';

    // Set the link's download attribute with the filename (optional)
    link.setAttribute('download', 'myWifiReport.pdf');

    // Append the link to the body (required for Firefox)
    document.body.appendChild(link);

    // Simulate a click on the link to trigger the download
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
}

function savePDFAll() {
    // Create a temporary link element
    var link = document.createElement('a');
    link.href = '/download_all';

    // Set the link's download attribute with the filename (optional)
    link.setAttribute('download', 'myWifiReport.pdf');

    // Append the link to the body (required for Firefox)
    document.body.appendChild(link);

    // Simulate a click on the link to trigger the download
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
}

/* WEBSOCKETS UPDATES */
// Update all the text, images and matrices after a new Post of data
var socket = io();

socket.on('update_data', function(data) {
    scans_data = data[0];
    active_scan = parseInt(data[1]);

    var scan_picker_html = "<div class='radio'>";
    scans_data.forEach((scan, i) => {
        scan_picker_html += `<input type="radio" id="scan_${i + 1}" name="scans_select" value="${i + 1}">`;
        scan_picker_html += `<label for="scan_${i + 1}" id="scan_label_${i + 1}" class="${i == active_scan ? 'active' : ''}">Scan ${i + 1}</label>`;
    });
    scan_picker_html += "</div>";

    document.getElementById('scan_picker').innerHTML = scan_picker_html;
    attachScanRadioButtonListeners(); // Reattach event listeners to radio buttons

    document.getElementById('wifi_name').innerText = "WiFi: " + scans_data[active_scan].wifi_name;
    document.getElementById('wifi_min_strength').innerText = "Min: " + scans_data[active_scan].wifi_min_strength + " dBm";
    document.getElementById('wifi_max_strength').innerText = "Max: " + scans_data[active_scan].wifi_max_strength + " dBm";
    document.getElementById('wifi_avg_strength').innerText = "Average: " + scans_data[active_scan].wifi_avg_strength + " dBm";
    document.getElementById('wifi_min_speed').innerText = "Min: " + scans_data[active_scan].wifi_min_speed + " Mbps";
    document.getElementById('wifi_max_speed').innerText = "Max: " + scans_data[active_scan].wifi_max_speed + " Mbps";
    document.getElementById('wifi_avg_speed').innerText = "Average: " + scans_data[active_scan].wifi_avg_speed + " Mbps";

    // Reload images to force update
    var mapImg = new Image();
    mapImg.src = scans_data[active_scan].map_img_path + '?' + new Date().getTime(); // Cache busting
    mapImg.onload = function() {
        document.getElementById('map_img').src = mapImg.src;
    };

    var wallsImg = new Image();
    wallsImg.src = scans_data[active_scan].walls_img_path + '?' + new Date().getTime(); // Cache busting
    wallsImg.onload = function() {
        document.getElementById('walls_img').src = wallsImg.src;
    };

    // Update matrices
    updateMatrix('strength', scans_data[active_scan].wifi_strength_matrix, 'dBm', -127);
    updateMatrix('speed', scans_data[active_scan].wifi_speed_matrix, 'Mbps', scans_data[active_scan].wifi_max_speed);
});

// Get the html for the matrix and display it
function updateMatrix(type, matrixData, unit, minValue) {
    $.ajax({
        type: 'POST',
        url: '/render_matrix',
        data: {
            type: type,
            matrix_data: JSON.stringify(matrixData),
            unit: unit,
            min_value: minValue
        },
        success: function(response) {
            if (type === 'strength') {
                document.getElementById('strength_image').innerHTML = response.html;
            } else {
                document.getElementById('speed_image').innerHTML = response.html;
            }
            setPixelColors();
        },
        error: function(error) {
            console.log('Error:', error);
        }
    });
}

// When updating the strength and speed matrix also update the color values of the pixel divs
function setPixelColors() {
    var pixels = document.querySelectorAll('.pixel');
    pixels.forEach(function(pixel) {
        var value = parseInt(pixel.getAttribute('data-value'));
        var maxVal = parseInt(pixel.getAttribute('max-val'));
        if (value == 0) {
            pixel.style.backgroundColor = `rgb(255,255,255)`;
        } else {
            var ratio = Math.abs(value / maxVal);
            var red, green;
            if (value > 0) {
                red = Math.floor((1 - ratio) * 255);
                green = Math.floor(ratio * 255);
            } else {
                red = Math.floor(ratio * 255);
                green = Math.floor((1 - ratio) * 255);
            }
            var blue = 0;
            pixel.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
        }
    });
}