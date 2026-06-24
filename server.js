const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MONGO_URI = 'mongodb+srv://Admin:homyakV3_212400@cluster0.owsi01j.mongodb.net/homyak?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Подключено к MongoDB'))
  .catch(err => console.error('❌ Ошибка MongoDB:', err.message));

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    refCode: String,
    taps: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    rebirthCount: { type: Number, default: 0 },
    clickPower: { type: Number, default: 1 },
    inventory: { type: Array, default: [] },
    dailyClaimed: { type: Array, default: [] },
    autoClickers: { type: Number, default: 0 },
    clickUpgrade: { type: Number, default: 0 },
    autoClickerPrice: { type: Number, default: 25 },
    clickUpgradePrice: { type: Number, default: 10 },
    playTime: { type: Number, default: 0 },
    minerBest: { type: Number, default: 0 },
    soldItems: { type: Number, default: 0 },
    firstLogin: { type: Date, default: Date.now },
    lastDailyClaim: { type: Number, default: 0 },
    activeBoosts: { type: Object, default: {} },
    creatorUnlocked: { type: Boolean, default: false },
    creatorUnlockedForever: { type: Boolean, default: false },
    _ownerUnlockNotified: { type: Boolean, default: false },
    workSlots: { type: Array, default: Array(9).fill(null) },
    hamsterIdCounter: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    banUntil: { type: Date, default: null },
    adminUnlocked: { type: Boolean, default: false }
});

const chatSchema = new mongoose.Schema({
    username: String,
    message: String,
    isPrivate: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

// РЕГИСТРАЦИЯ
app.post('/register', async (req, res) => {
    try {
        const { username, password, refCode } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'Такой ник уже занят' });
        const newUser = new User({
            username,
            password,
            refCode: username.slice(0,4) + Math.random().toString(36).slice(2,6).toUpperCase()
        });
        if (refCode) {
            const referrer = await User.findOne({ refCode });
            if (referrer) {
                referrer.gems += 60;
                referrer.tokens += 150;
                await referrer.save();
                newUser.taps = 5000;
            }
        }
        await newUser.save();
        res.json({ success: true, message: 'Регистрация успешна!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ВХОД
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== password) return res.status(400).json({ error: 'Неверный ник или пароль' });
        if (user.banned) {
            const now = Date.now();
            if (user.banUntil && now < user.banUntil) {
                const remain = Math.ceil((user.banUntil - now) / 1000);
                return res.status(403).json({ error: '⛔ Вы забанены! Причина: ' + user.banReason + ' (осталось ' + remain + 'с)' });
            } else if (user.banUntil && now >= user.banUntil) {
                user.banned = false;
                user.banReason = '';
                user.banUntil = null;
                await user.save();
            } else {
                return res.status(403).json({ error: '⛔ Вы забанены! Причина: ' + user.banReason });
            }
        }
        res.json({
            success: true,
            user: {
                username: user.username,
                taps: user.taps,
                tokens: user.tokens,
                gems: user.gems,
                totalClicks: user.totalClicks,
                rebirthCount: user.rebirthCount,
                clickPower: user.clickPower,
                inventory: user.inventory,
                dailyClaimed: user.dailyClaimed,
                autoClickers: user.autoClickers,
                clickUpgrade: user.clickUpgrade,
                autoClickerPrice: user.autoClickerPrice,
                clickUpgradePrice: user.clickUpgradePrice,
                playTime: user.playTime,
                minerBest: user.minerBest,
                soldItems: user.soldItems,
                firstLogin: user.firstLogin,
                lastDailyClaim: user.lastDailyClaim,
                activeBoosts: user.activeBoosts,
                creatorUnlocked: user.creatorUnlocked,
                creatorUnlockedForever: user.creatorUnlockedForever,
                _ownerUnlockNotified: user._ownerUnlockNotified,
                refCode: user.refCode,
                workSlots: user.workSlots,
                hamsterIdCounter: user.hamsterIdCounter,
                banned: user.banned,
                banReason: user.banReason,
                adminUnlocked: user.adminUnlocked || false
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// СОХРАНЕНИЕ
app.post('/save', async (req, res) => {
    try {
        const { username, data } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.banned) return res.status(403).json({ error: '⛔ Вы забанены!' });
        Object.keys(data).forEach(key => {
            if (key !== 'username' && key !== 'password' && key !== '_id' && key !== 'banned' && key !== 'banReason' && key !== 'banUntil' && key !== 'adminUnlocked') {
                user[key] = data[key];
            }
        });
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// СБРОС
app.post('/reset', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        user.taps = 0;
        user.tokens = 0;
        user.gems = 0;
        user.totalClicks = 0;
        user.rebirthCount = 0;
        user.clickPower = 1;
        user.inventory = [];
        user.dailyClaimed = [];
        user.autoClickers = 0;
        user.clickUpgrade = 0;
        user.autoClickerPrice = 25;
        user.clickUpgradePrice = 10;
        user.playTime = 0;
        user.minerBest = 0;
        user.soldItems = 0;
        user.activeBoosts = {};
        user.workSlots = Array(9).fill(null);
        user.hamsterIdCounter = 0;
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// БАН
app.post('/ban-nick', async (req, res) => {
    try {
        const { username, reason } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        user.banned = true;
        user.banReason = reason || 'Нарушение правил';
        user.banUntil = null;
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/ban-temp', async (req, res) => {
    try {
        const { username, reason, duration } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        user.banned = true;
        user.banReason = reason || 'Нарушение правил';
        user.banUntil = new Date(Date.now() + duration * 1000);
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/unban-nick', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        user.banned = false;
        user.banReason = '';
        user.banUntil = null;
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// KICK
app.post('/kick', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        res.json({ success: true, message: 'Игрок ' + username + ' кикнут' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ВЫДАЧА ПРЕДМЕТА
app.post('/give-item', async (req, res) => {
    try {
        const { username, item } = req.body;
        if (!username || !item) return res.status(400).json({ error: 'Не все поля заполнены' });
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        if (user.inventory.length >= 20) {
            return res.status(400).json({ error: 'Инвентарь игрока полон' });
        }
        const exists = user.inventory.some(i => i.id === item.id);
        if (exists) {
            return res.status(400).json({ error: 'Предмет уже есть у игрока' });
        }
        user.inventory.push({
            id: item.id || 'gift_' + Date.now(),
            emoji: item.emoji || '🎁',
            name: item.name || 'Предмет',
            sellTap: item.sellTap || 0,
            sellToken: item.sellToken || 0,
            sellGems: item.sellGems || 0
        });
        await user.save();
        res.json({ success: true, message: 'Предмет ' + item.name + ' выдан' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ИГРОКЕ
app.post('/user-info', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        res.json({
            success: true,
            user: {
                username: user.username,
                taps: user.taps,
                tokens: user.tokens,
                gems: user.gems,
                playTime: user.playTime,
                rebirthCount: user.rebirthCount,
                totalClicks: user.totalClicks
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// СПИСОК ИГРОКОВ
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username refCode gems tokens taps rebirthCount banned');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// РАЗДАЧА ВСЕМ ИГРОКАМ
app.post('/give-all', async (req, res) => {
    try {
        const { type, amount, message } = req.body;
        const users = await User.find({});
        let count = 0;
        for (const user of users) {
            if (user.banned) continue;
            if (type === 'taps') user.taps += amount;
            else if (type === 'tokens') user.tokens += amount;
            else if (type === 'gems') user.gems += amount;
            await user.save();
            count++;
        }
        if (message) {
            const chatMsg = new Chat({ username: 'System', message: message });
            await chatMsg.save();
        }
        res.json({ success: true, count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ИВЕНТЫ
// ============================================================
let globalEvent = null;

app.post('/event/start', async (req, res) => {
    try {
        const { type, duration, message } = req.body;
        globalEvent = {
            type: type,
            endTime: Date.now() + duration * 60000,
            message: message || 'Запущен ивент!'
        };
        const chatMsg = new Chat({ username: 'System', message: message || '🎉 Запущен ивент!' });
        await chatMsg.save();
        res.json({ success: true, event: globalEvent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/event/stop', async (req, res) => {
    try {
        globalEvent = null;
        const chatMsg = new Chat({ username: 'System', message: '⏹️ Ивент завершён!' });
        await chatMsg.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/event/status', async (req, res) => {
    try {
        if (globalEvent && globalEvent.endTime > Date.now()) {
            res.json({ active: true, event: globalEvent });
        } else {
            globalEvent = null;
            res.json({ active: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
