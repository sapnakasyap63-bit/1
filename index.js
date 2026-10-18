const { Client, GatewayIntentBits } = require('discord.js');
const mineflayer = require('mineflayer');
const express = require('express');

// ---- WEB SERVER (RENDER KEEP-ALIVE) ----
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🌐 VorstyAFK Worker Node Online 24/7!'));
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

// ---- DISCORD BOT SETUP ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Track active bot instance on this worker
let activeBotInstance = null;

client.once('ready', () => {
    console.log(`🤖 AFK Worker Bot logged in as ${client.user.tag}`);
});

// ---- WORKER DISCORD COMMANDS ----
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Syntax: $deploy <server_ip> [port]
    if (message.content.startsWith('$deploy')) {
        const args = message.content.split(/\s+/);
        const ip = args[1];
        const rawPort = args[2];

        if (!ip) {
            return message.reply('❌ Use syntax: `$deploy <server_ip> [port]`');
        }

        let port = null;
        if (rawPort && !isNaN(parseInt(rawPort))) {
            port = parseInt(rawPort);
        }

        // Stop existing instance if already running
        if (activeBotInstance) {
            try {
                activeBotInstance.quit();
            } catch (e) {}
            activeBotInstance = null;
        }

        const displayEndpoint = port ? `${ip}:${port}` : ip;
        message.reply(`⚙️ Deploying AFK bot onto target server \`${displayEndpoint}\`...`);
        
        launchMinecraftBot(ip, port, message);
    }

    // Manual Stop Command: $stopbot
    if (message.content.startsWith('$stopbot')) {
        if (activeBotInstance) {
            try {
                activeBotInstance.quit();
            } catch (e) {}
            activeBotInstance = null;
            return message.reply(`🛑 AFK bot has been stopped and disconnected.`);
        } else {
            return message.reply(`❌ No active bot running right now.`);
        }
    }
});

// ---- ROBUST MINECRAFT AUTOMATION ENGINE ----
function launchMinecraftBot(host, port, discordContext) {
    const botName = process.env.BOT_USERNAME || `VorstyAFK_${Math.floor(100 + Math.random() * 900)}`;
    const botPassword = `VorstyPass_${Math.floor(100 + Math.random() * 900)}`;

    console.log(`📡 Connecting client to ${host}:${port || 'default'}`);

    const botOptions = {
        host: host,
        username: botName,
        auth: 'offline',
        version: false, // Auto-detect Minecraft version (prevents version mismatch issues)
        checkTimeoutInterval: 120000,
        viewDistance: 'tiny'
    };

    if (port) {
        botOptions.port = port;
    }

    let bot;
    try {
        bot = mineflayer.createBot(botOptions);
        activeBotInstance = bot;
    } catch (err) {
        const errMsg = err?.message || err?.toString() || 'Instantiation error';
        return discordContext.channel.send(`❌ **Launch Error:** Failed to create bot: \`${errMsg}\``);
    }

    let moveInterval = null;
    let jumpInterval = null;
    let chatInterval = null;

    // Auto Register & Login for AuthMe plugins
    bot.on('message', (jsonMsg) => {
        const chatMessage = jsonMsg.toString().toLowerCase();

        if (chatMessage.includes('register') || chatMessage.includes('/register') || chatMessage.includes('reg')) {
            setTimeout(() => {
                if (bot && bot.entity) {
                    bot.chat(`/register ${botPassword}${botPassword}`);
                }
            }, 1500);
        }

        if (chatMessage.includes('login') || chatMessage.includes('/login') || chatMessage.includes('log ')) {
            setTimeout(() => {
                if (bot && bot.entity) {
                    bot.chat(`/login ${botPassword}`);
                }
            }, 1500);
        }
    });

    bot.once('spawn', () => {
        const targetStr = port ? `${host}:${port}` : host;
        console.log(`[AFK Bot] Successfully spawned and joined ${targetStr}`);
        discordContext.channel.send(`✅ AFK Bot successfully joined server \`${targetStr}\`!`);

        setTimeout(() => {
            if (bot && bot.entity) {
                bot.chat(`/register ${botPassword}${botPassword}`);
                bot.chat(`/login ${botPassword}`);
            }
        }, 2000);

        // Anti-AFK Random Look & Move Loop
        moveInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            const randomYaw = (Math.random() * 360) * (Math.PI / 180);
            const randomPitch = ((Math.random() * 60) - 30) * (Math.PI / 180);
            bot.look(randomYaw, randomPitch, true);

            const directions = ['forward', 'back', 'left', 'right'];
            const chosenDir = directions[Math.floor(Math.random() * directions.length)];
            
            bot.setControlState(chosenDir, true);
            setTimeout(() => { if (bot && bot.entity) bot.setControlState(chosenDir, false); }, 3000);
        }, 4000);

        // Jump Loop
        jumpInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            bot.setControlState('jump', true);
            setTimeout(() => { if (bot && bot.entity) bot.setControlState('jump', false); }, 500);
        }, 11000);

        // Promotional Chat Loop
        chatInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            bot.chat("MADE BY - VORSTYAFK");
        }, 30 * 60000);
    });

    bot.on('death', () => {
        try { bot.respawn(); } catch (err) {}
    });

    bot.on('end', (reason) => {
        console.log(`🔌 AFK Bot disconnected. Reason: ${reason}`);
        clearInterval(moveInterval);
        clearInterval(jumpInterval);
        clearInterval(chatInterval);

        const cleanReason = reason || 'Connection closed';
        try {
            discordContext.channel.send(`⚠️ **Alert:** AFK Bot disconnected. Reason: \`${cleanReason}\`.`);
        } catch (e) {}

        if (activeBotInstance === bot) {
            activeBotInstance = null;
        }
    });

    bot.on('error', (err) => {
        const errorDetails = err?.message || err?.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.log(`[AFK Bot] Error: ${errorDetails}`);
        try {
            discordContext.channel.send(`❌ **Error Alert:** AFK Bot error: \`${errorDetails}\``);
        } catch (e) {}
    });
}

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error("❌ DISCORD_TOKEN missing!");
}
