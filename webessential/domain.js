var applicationdomain = "https://api.workwize.in/";
var applicationdomain2 = "https://localhost:7151/";
var loginendpoint = applicationdomain + "api/login"


function ShowSpinner() {
    document.getElementById("SpinnerLoader").style.display = "block";
};
function HideSpinner() {
    document.getElementById("SpinnerLoader").style.display = "none";
};

function formatDate(dateString) {
    // Create a new Date object from the input string
    let date = new Date(dateString);
    
    // Get the day, month, and year
    let day = String(date.getDate()).padStart(2, '0'); // Ensure 2-digit format
    let month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    let year = date.getFullYear();

    // Return the formatted date
    return `${day}-${month}-${year}`;
}

// The API sends server times in UTC without a zone ("2026-10-31T13:02:00"); a bare string like that
// would be read as the viewer's local time, so mark it as UTC. Returns null for empty or invalid values.
function parseApiDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    var s = String(value).trim();
    if (s.startsWith('0001')) return null;
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
    }
    var d = new Date(s);
    return isNaN(d) ? null : d;
}

// Shows a date in Maldives Time (UTC+5) whatever the viewer's own time zone is
function formatMaldives(value, options) {
    var d = parseApiDate(value);
    if (!d) return '';
    return d.toLocaleString('en-GB', Object.assign({ timeZone: 'Indian/Maldives' }, options));
}


function loadScriptSequentially(scripts, index = 0) {
    if (index >= scripts.length) {
        //console.log('All scripts loaded successfully');
        return;
    }

    const script = document.createElement('script');
    script.src = scripts[index] + '?v=' + new Date().getTime();

    script.onload = function() {
        //console.log(`Loaded: ${scripts[index]}`);
        loadScriptSequentially(scripts, index + 1);
    };

    script.onerror = function() {
        //console.error(`Failed to load: ${scripts[index]}`);
        // Continue loading next script even if one fails
        loadScriptSequentially(scripts, index + 1);
    };

    document.body.appendChild(script);
}