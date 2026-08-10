const supabaseUrl = "https://ewlxcpgbavfvgnohtkuq.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHhjcGdiYXZmdmdub2h0a3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcyNDMsImV4cCI6MjA4NDMzMzI0M30.d6zQpak_F9G12DG7_ZKdoYPyfPL8YQTbhnAQVltcHxs";

async function getOpenApi() {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
        }
    });
    const data = await res.json();
    console.log("Paths available:");
    console.log(Object.keys(data.paths || {}));
    if (data.definitions) {
        console.log("Definitions:");
        console.log(Object.keys(data.definitions));
    }
}

getOpenApi();
