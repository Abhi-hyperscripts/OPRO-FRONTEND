const applicationdomain1 = "https://api.workwize.in/";
const applicationdomain = "https://localhost:7151/";
const applicationdomain3 = "https://testing.hyprscripts.com/";
const loginendpoint = applicationdomain + "api/login"


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