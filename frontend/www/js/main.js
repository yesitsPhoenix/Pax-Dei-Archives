// Main JS
// Initialize Supabase client
// SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co/'
// SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY'
// supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


document.getElementById("searchInput").addEventListener("keyup", function (e) {
    if (e.key === "Enter") {
        const query = e.target.value.trim();
        if (query) {
            // Replace with your own search logic or route
            alert("Search for: " + query);
            // Optionally redirect: window.location.href = `/search?q=${encodeURIComponent(query)}`
        }
    }
});
