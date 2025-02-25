const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const app = express();
const axios = require("axios");
const http = require("https");
const path = require("path");

app.use(bodyParser.json());
app.use("/favicon.ico", express.static(path.join(__dirname, "public/favicon.ico")));

let queue = []; // Array to store queue items as objects { user, item }
let queueOpen = false; // Flag to track whether the queue is open
let selfPingInterval; // Variable to store the self-ping interval ID
const projectUrl = "https://sangsangtwitch.vercel.app/";

app.get("/randomline", async (req, res) => {
    try {
        const response = await axios.get("https://pastebin.com/raw/nwYG6VsA", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        const lines = response.data.split("\n");
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        res.send(randomLine);
    } catch (error) {
        console.error("Error fetching Pastebin:", error);
        res.status(500).send("Error fetching data");
    }
});

app.get("/fight", async (req, res) => {
    const pastebinURL = "https://pastebin.com/raw/nwYG6VsA";
    const response = await fetch(pastebinURL);
    const text = await response.text();
    const lines = text.split("\n");
    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    res.send(randomLine);
});

// Endpoint to fetch and display the entire list from an external URL
app.get("/quotes", async (req, res) => {
    const externalUrl = "https://twitch.center/customapi/quote/list?token=219131ad";

    try {
        // Fetch the content from the external URL
        const response = await fetch(externalUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch quotes: ${response.statusText}`);
        }

        // Get the list of quotes and split them into lines
        const data = await response.text();
        const quotesList = data.split("\n").map((quote) => quote.trim()).filter((quote) => quote); // Clean up empty lines

        // Format the list for display
        const formattedQuotes = quotesList.join("\n"); // Join with newlines for plain text response
        
        res.set("Content-Type", "text/plain");
        res.send(formattedQuotes); // Respond with the entire list
    } catch (error) {
        console.error(`Error fetching quotes: ${error.message}`);
        res.status(500).send("Failed to fetch quotes. Please try again later.");
    }
});

// Add a route for /api/fight
app.get('/api/fight', (req, res) => {
  const { sender, touser, randomChatter } = req.query;

  // Validate query parameters
  if (!sender) {
    return res.status(400).send("Missing 'sender' parameter");
  }

  // Determine the target
  const target = touser || randomChatter || "someone";

  // Response message
  const message = `${sender} picked a fight with ${target} $(urlfetch https://pastebin.com/raw/nwYG6VsA!)`;

  res.status(200).send(message);
});

// Default route
app.get("/", (req, res) => {
    res.send("Welcome to the Nightbot Queue Manager! Use /queue, /add-to-queue, /clear-queue, /open-queue, /close-queue, or /next.");
  
});

// Endpoint to display the queue in the original format (continuous list for Nightbot)
app.get("/queue", (req, res) => {
    if (queue.length > 0) {
        const formattedQueue = queue
            .map((entry, index) => `${index + 1}. ${entry.item} (${entry.user})`)
            .join(" | "); // Keep the original format with " | "
        return res.send(`Current Queue: ${formattedQueue}`);
    } else {
        return res.send("The queue is currently empty.");
    }
});

// New endpoint to display the queue with each item on a new line
app.get("/queue-list", (req, res) => {
    if (queue.length > 0) {
        const formattedQueue = queue
            .map((entry, index) => `${index + 1}. ${entry.item} (${entry.user})`)
            .join("\n"); // Use newline character for plain text formatting

        // Set Content-Type to text/plain to ensure newlines are rendered
        res.set("Content-Type", "text/plain");
        return res.send(`Current Queue:\n${formattedQueue}`);
    } else {
        // Set Content-Type to text/plain for consistency
        res.set("Content-Type", "text/plain");
        return res.send("The queue is currently empty.");
    }
});

// Endpoint to show the next item in the queue
app.get("/next", (req, res) => {
    if (queue.length > 0) {
        const nextItem = queue[0];
        return res.send(`Next in queue: ${nextItem.item} (${nextItem.user})`);
    } else {
        return res.send("The queue is currently empty.");
    }
});

// POST endpoint to handle the "!queue" command
app.post("/add-to-queue", (req, res) => {
    const { user, message } = req.body;

    if (!queueOpen) {
        return res.send(`@${user}, the queue is currently closed. You cannot add items right now.`);
    }

    const queueItem = message.replace("!queue ", "").trim();
    if (queueItem) {
        queue.push({ user, item: queueItem });
        return res.send(`@${user}, your item has been added to the queue! Current queue length: ${queue.length} items.`);
    } else {
        return res.send(`@${user}, please provide an item to add to the queue. Usage: !queue <item>`);
    }
});

// GET endpoint for /add-to-queue (Nightbot-compatible)
app.get("/add-to-queue", (req, res) => {
    const user = req.query.user || "anonymous";
    const message = req.query.message || "";

    if (!queueOpen) {
        return res.send(`@${user}, the queue is currently closed. You cannot add items right now.`);
    }

    const queueItem = message.replace("!queue ", "").trim();
    if (queueItem) {
        queue.push({ user, item: queueItem });
        return res.send(`@${user}, your item has been added to the queue! Current queue length: ${queue.length} items.`);
    } else {
        return res.send(`@${user}, please provide an item to add to the queue. Usage: !queue <item>`);
    }
});

// POST endpoint to clear the queue
app.post("/clear-queue", (req, res) => {
    queue = [];
    return res.send("The queue has been cleared!");
});

// GET endpoint for /clear-queue (Nightbot-compatible)
app.get("/clear-queue", (req, res) => {
    queue = [];
    return res.send("The queue has been cleared!");
});

// POST endpoint to remove a specific item from the queue
app.post("/remove-from-queue", (req, res) => {
    const { user, message } = req.body;

    const position = parseInt(message.replace("!removequeue ", "").trim(), 10);

    if (!isNaN(position) && position > 0 && position <= queue.length) {
        const removedItem = queue.splice(position - 1, 1); // Remove the item at the given position
        return res.send(`@${user}, item #${position} has been removed from the queue!`);
    } else {
        return res.send(`@${user}, invalid position. Please provide a valid queue number to remove.`);
    }
});

// GET endpoint for /remove-from-queue (Nightbot-compatible)
app.get("/remove-from-queue", (req, res) => {
    const position = parseInt(req.query.position, 10);

    if (!isNaN(position) && position > 0 && position <= queue.length) {
        const removedItem = queue.splice(position - 1, 1); // Remove the item at the given position
        return res.send(`Item #${position} has been removed from the queue!`);
    } else {
        return res.send("Invalid position. Please provide a valid queue number to remove.");
    }
});

// Endpoint to open the queue and start self-pinging
app.get("/open-queue", (req, res) => {
    queueOpen = true;

    // Start self-pinging
    if (!selfPingInterval) {
        selfPingInterval = setInterval(() => {
            http.get(projectUrl, (res) => {
                console.log(`Pinged ${projectUrl}: ${res.statusCode}`);
            }).on("error", (err) => {
                console.error(`Error pinging ${projectUrl}: ${err.message}`);
            });
        }, 300000); // Ping every 5 minutes (300,000 ms)
        console.log("Self-pinging activated.");
    }

    res.send("The queue is now open!");
});

// Endpoint to close the queue and stop self-pinging
app.get("/close-queue", (req, res) => {
    queueOpen = false;

    // Stop self-pinging
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
        selfPingInterval = null;
        console.log("Self-pinging deactivated.");
    }

    res.send("The queue is now closed!");
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${3000}`);
});
