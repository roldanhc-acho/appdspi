const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://your-project-ref.supabase.co";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "your-supabase-anon-key";

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
