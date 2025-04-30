let isSignedIn = localStorage.getItem('isSignedIn') === 'true';
let typingTimer;
const doneTypingInterval = 300;
const priceUpdateInterval = 5000; // Unified to 5 seconds to respect API rate limits
let livePrices = new Map();
let activeTrades = JSON.parse(localStorage.getItem('trades') || '[]');
let priceUpdateIntervalId = null;

const INTRADAY_OPEN = { hours: 9, minutes: 15 };
const INTRADAY_CLOSE = { hours: 15, minutes: 15 };
const HOLDING_CLOSE = { hours: 15, minutes: 30 };
const US_MARKET_OPEN = { hours: 9, minutes: 30 }; // 9:30 AM EST
const US_MARKET_CLOSE = { hours: 16, minutes: 0 }; // 4:00 PM EST
const GROWW_BEARER_TOKEN = 'Bearer eyJraWQiOiJXTTZDLVEiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NDYyNzEyMTMsImlhcCI6MTc0NjAxMTk4MCwibmJmIjoxNzQ2MDExOTMwLCJzdWIiOiJ7XCJlbWFpbElkXCI6XCJ2aWpheWRhcmVrYXI0MUBnbWFpbC5jb21cIixcInBsYXRmb3JtXCI6XCJ3ZWJcIixcInBsYXRmb3JtVmVyc2lvblwiOm51bGwsXCJvc1wiOm51bGwsXCJvc1ZlcnNpb25cIjpudWxsLFwiaXBBZGRyZXNzXCI6XCIxMDMuMTkwLjk2LjE0MyxcIixcIm1hY0FkZHJlc3NcIjpudWxsLFwidXNlckFnZW50XCI6XCJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTM1LjAuMC4wIFNhZmFyaS81MzcuMzZcIixcImdyb3d3VXNlckFnZW50XCI6bnVsbCxcImRldmljZUlkXCI6XCIxNWQyOTJlNC01MDY5LTU4YjktYWRjYy01NDY2ZTAwN2E3YTJcIixcInNlc3Npb25JZFwiOlwiM2EyN2E3NTYtNDAyOC00MjA5LTg0OWQtN2YxN2Y4NDBlYWMyXCIsXCJzZXNzaW9uSWRJc3N1ZWRBdFwiOjE3NDQ5NTMzMTA2OTEsXCJzdXBlckFjY291bnRJZFwiOlwiQUNDMDQwMzk0NTE3NTk3NFwiLFwidXNlckFjY291bnRJZFwiOlwiQUNDMDQwMzk0NTE3NTk3NFwiLFwidHlwZVwiOlwiQVRcIixcInRva2VuRXhwaXJ5XCI6MTc0NjI3MTIxMzM5MixcInRva2VuSWRcIjpcImMyZjkxOTU2LTVkNDMtNGRkMS05Y2UxLTYyOWY1MWY2MTBjM1wiLFwiYnNlVXNlcklkXCI6XCIwNjAxNzA0NzExXCJ9IiwiaXNzIjoiZ3Jvd3diaWxsaW9ubWlsbGVubmlhbCJ9.69-jv0WTiWrqscyZAbkFkGve_RAQzXiVhG6-hOs-S9cXx15TcU9SUTyMVSL2SLvdXhNNDjU4jIApBJs6LbOQew';

// Sign-in/out handlers
function toggleSignInOverlay() {
    if (!isSignedIn) {
        document.getElementById('signInOverlay').style.display = 'flex';
    }
}

function handleSignIn() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username.length >= 5 && password.length >= 6) {
        isSignedIn = true;
        localStorage.setItem('userid', username);
        localStorage.setItem('isSignedIn', 'true');
        document.getElementById('signInOverlay').style.display = 'none';
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('signInBtn').textContent = 'Sign Out';
        document.getElementById('signInBtn').onclick = handleSignOut;
    } else {
        alert('Username must be at least 5 characters and password at least 6 characters.');
    }
}

function handleSignOut() {
    isSignedIn = false;
    localStorage.setItem('isSignedIn', 'false');
    localStorage.removeItem('userid');
    document.getElementById('landingPage').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('signInBtn').textContent = 'Sign In';
    document.getElementById('signInBtn').onclick = toggleSignInOverlay;
}

// Market hours
function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const openTime = INTRADAY_OPEN.hours * 60 + INTRADAY_OPEN.minutes;
    const closeTime = HOLDING_CLOSE.hours * 60 + HOLDING_CLOSE.minutes;
    return currentTime >= openTime && currentTime < closeTime;
}

function isUSMarketOpen() {
    const now = new Date();
    const estOffset = -5 * 60 * 60 * 1000;
    const estTime = new Date(now.getTime() + estOffset);
    const hours = estTime.getUTCHours();
    const minutes = estTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const openTime = US_MARKET_OPEN.hours * 60 + US_MARKET_OPEN.minutes;
    const closeTime = US_MARKET_CLOSE.hours * 60 + US_MARKET_CLOSE.minutes;
    return currentTime >= openTime && currentTime < closeTime;
}

function formatISTTime(date) {
    const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-IN', options);
}

function formatESTTime(date) {
    const options = { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

// API calls
function fetchStockSymbols(query) {
    const apiUrl = `https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php?classic=true&query=${encodeURIComponent(query)}&type=1&format=json`;
    return fetch(apiUrl)
        .then(response => response.json())
        .then(data => data)
        .catch(error => {
            console.error("Error fetching Indian stock symbols:", error);
            return [];
        });
}

function fetchUSStockSymbols(query) {
    const apiUrl = `https://groww.in/v1/api/search/v3/query/global/st_query?from=0&query=${encodeURIComponent(query)}&size=6&web=true`;
    return fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        }
    })
        .then(response => response.json())
        .then(data => data.hits || [])
        .catch(error => {
            console.error("Error fetching US stock symbols:", error);
            return [];
        });
}

async function fetchLatestPrice(symbol, marketType) {
    if (marketType === 'usStocks') {
        if (!isUSMarketOpen()) {
            return livePrices.get(symbol) || 0;
        }
        try {
            const apiUrl = 'https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/US/latest_prices_batch';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': GROWW_BEARER_TOKEN,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
                },
                body: JSON.stringify({ symbols: [symbol] })
            });
            if (response.status === 401) {
                alert('Authentication failed for US stock prices. Please sign in again.');
                handleSignOut();
                return 0;
            }
            const data = await response.json();
            const priceData = data[0];
            const latestPrice = parseFloat(priceData?.ltp);
            if (latestPrice > 0) {
                livePrices.set(symbol, latestPrice);
                return latestPrice;
            }
            throw new Error('Price not found');
        } catch (error) {
            console.error(`Error fetching US price for ${symbol}:`, error);
            return livePrices.get(symbol) || 0;
        }
    } else {
        if (!isMarketOpen()) {
            return livePrices.get(symbol) || 0;
        }
        try {
            const response = await fetch(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${symbol}`);
            const data = await response.json();
            const latestPrice = parseFloat(data.data?.pricecurrent);
            if (latestPrice > 0) {
                livePrices.set(symbol, latestPrice);
                return latestPrice;
            }
            throw new Error('Price not found');
        } catch (error) {
            console.error(`Error fetching Indian price for ${symbol}:`, error);
            return livePrices.get(symbol) || 0;
        }
    }
}

// Search and select
function callapi(e) {
    clearTimeout(typingTimer);
    const searchValue = e.target.value.trim();
    const tradeType = document.getElementById('tradePanelTitle').textContent.includes('US Stock') ? 'usStocks' : 'indian';
    if (!searchValue) {
        document.getElementById('searchResultsContainer').classList.add('hidden');
        return;
    }
    typingTimer = setTimeout(() => {
        if (tradeType === 'usStocks') {
            fetchUSStockSymbols(searchValue).then(displayUSSearchResults);
        } else {
            fetchStockSymbols(searchValue).then(displaySearchResults);
        }
    }, doneTypingInterval);
}

function displaySearchResults(data) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('searchResults');
    resultsList.innerHTML = '';

    if (data && Array.isArray(data) && data.length > 0) {
        resultsContainer.classList.remove('hidden');
        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-gray-700 cursor-pointer text-white';
            const stockName = item.name || item.stock_name || '';
            const stockSymbol = item.sc_id || '';
            const sector = item.sc_sector || '';
            li.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-medium truncate">${stockName} (${stockSymbol})</span>
                    <span class="text-xs text-gray-400">${sector}</span>
                </div>`;
            li.addEventListener('click', () => selectStock(stockSymbol, stockName, 'indian'));
            resultsList.appendChild(li);
        });
    } else {
        resultsContainer.classList.remove('hidden');
        const li = document.createElement('li');
        li.className = 'px-4 py-2 text-gray-400';
        li.textContent = 'No matching Indian stocks found';
        resultsList.appendChild(li);
    }
}

function displayUSSearchResults(results) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('searchResults');
    resultsList.innerHTML = '';

    if (results && Array.isArray(results) && results.length > 0) {
        resultsContainer.classList.remove('hidden');
        results.forEach(item => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-gray-700 cursor-pointer text-white';
            const stockName = item.name || item.symbol;
            const stockSymbol = item.symbol;
            const sector = item.sector || 'US Stock';
            li.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-medium truncate">${stockName} (${stockSymbol})</span>
                    <span class="text-xs text-gray-400">${sector}</span>
                </div>`;
            li.addEventListener('click', () => selectStock(stockSymbol, stockName, 'usStocks'));
            resultsList.appendChild(li);
        });
    } else {
        resultsContainer.classList.remove('hidden');
        const li = document.createElement('li');
        li.className = 'px-4 py-2 text-gray-400';
        li.textContent = 'No matching US stocks found';
        resultsList.appendChild(li);
    }
}

async function selectStock(symbol, name, marketType) {
    if (!isSignedIn) {
        alert('Please sign in to select stocks.');
        toggleSignInOverlay();
        return;
    }
    const symbolInput = document.getElementById('stockSymbol');
    const priceInput = document.getElementById('price');
    symbolInput.value = symbol;
    document.getElementById('searchResultsContainer').classList.add('hidden');
    symbolInput.dataset.stockName = name;
    symbolInput.dataset.marketType = marketType;

    try {
        showLoader();
        const price = await fetchLatestPrice(symbol, marketType);
        if (price > 0) {
            priceInput.value = marketType === 'usStocks' ? `$${price.toFixed(2)}` : formatIndianNumber(price);
            livePrices.set(symbol, price);
            startPriceUpdateForInput(symbol, priceInput, marketType);
        } else {
            priceInput.value = 'N/A';
        }
        hideLoader();
    } catch (error) {
        console.error(`Error selecting stock ${symbol}:`, error);
        priceInput.value = 'N/A';
        hideLoader();
    }
}

function startPriceUpdateForInput(symbol, priceInput, marketType) {
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId);
    }
    priceUpdateIntervalId = setInterval(async () => {
        const isMarketActive = marketType === 'usStocks' ? isUSMarketOpen() : isMarketOpen();
        if (isMarketActive) {
            try {
                const latestPrice = await fetchLatestPrice(symbol, marketType);
                if (latestPrice > 0) {
                    priceInput.value = marketType === 'usStocks' ? `$${latestPrice.toFixed(2)}` : formatIndianNumber(latestPrice);
                    livePrices.set(symbol, latestPrice);
                }
            } catch (error) {
                console.error(`Error updating price for ${symbol}:`, error);
            }
        }
    }, priceUpdateInterval);
}

// Trade panel
function toggleTradePanel(type) {
    if (!isSignedIn) {
        alert('Please sign in to trade.');
        toggleSignInOverlay();
        return;
    }
    const overlay = document.getElementById('tradeOverlay');
    const panel = document.getElementById('tradePanel');
    const title = document.getElementById('tradePanelTitle');
    title.textContent = type === 'usStocks' ? 'Add US Stock' : type === 'holding' ? 'Add Holding' : 'New Trade';
    overlay.classList.toggle('open');
    panel.classList.toggle('open');
    resetTradeForm();
}

function closeTradePanel(event) {
    const overlay = document.getElementById('tradeOverlay');
    const panel = document.getElementById('tradePanel');
    if (!panel.contains(event.target) || event.target.tagName === 'BUTTON') {
        overlay.classList.remove('open');
        panel.classList.remove('open');
    }
}

function resetTradeForm() {
    document.getElementById('tradeForm').reset();
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId);
        priceUpdateIntervalId = null;
    }
}

function handleTradeSubmit(type, isBuy) {
    if (!isSignedIn) {
        alert('Please sign in to submit trades.');
        toggleSignInOverlay();
        return;
    }
    const isUSStock = type === 'usStocks';
    const isMarketActive = isUSStock ? isUSMarketOpen() : isMarketOpen();
    if (!isMarketActive) {
        alert(`Market is closed! Trading is allowed only between ${isUSStock ? '9:30 AM and 4:00 PM EST' : '9:15 AM and 3:30 PM IST'}. Current time: ${isUSStock ? formatESTTime(new Date()) : formatISTTime(new Date())}`);
        return;
    }

    const stockSymbolInput = document.getElementById('stockSymbol');
    const stockSymbol = stockSymbolInput.value.toUpperCase();
    const stockName = stockSymbolInput.dataset.stockName || stockSymbol;
    const quantity = document.getElementById('quantity').value;
    const priceInput = document.getElementById('price');
    const buyAtPrice = parseFloat(document.getElementById('buyAtPrice').value) || 0;
    const stopLoss = parseFloat(document.getElementById('stopLoss').value) || 0;
    const targetProfit = parseFloat(document.getElementById('targetProfit').value) || 0;

    if (!stockSymbol || !quantity) {
        alert('Please fill all required fields');
        return;
    }

    showLoader();
    fetchLatestPrice(stockSymbol, type).then(latestPrice => {
        if (latestPrice) {
            const effectiveBuyPrice = (isBuy && buyAtPrice > 0) ? buyAtPrice : latestPrice;
            priceInput.value = isUSStock ? `$${latestPrice.toFixed(2)}` : formatIndianNumber(latestPrice);

            const tradeData = {
                symbol: stockSymbol,
                quantity: parseInt(quantity),
                price_buy: isBuy ? effectiveBuyPrice : 0,
                price_sell: !isBuy ? latestPrice : 0,
                currentPrice: latestPrice,
                stock_name: stockName,
                type: type,
                action: isBuy ? 'BUY' : 'SELL',
                timestamp: new Date().toISOString(),
                completed: false,
                stopLoss: stopLoss,
                targetProfit: targetProfit,
                buyAtPrice: isBuy ? buyAtPrice : 0,
                marketType: isUSStock ? 'usStocks' : 'indian',
                currency: isUSStock ? 'USD' : 'INR'
            };

            const oppositeTrade = activeTrades.find(t => t.symbol === stockSymbol && t.type === type && t.action !== tradeData.action && !t.completed);
            if (oppositeTrade) {
                oppositeTrade.completed = true;
                oppositeTrade.price_sell = !isBuy ? latestPrice : oppositeTrade.price_sell;
                oppositeTrade.price_buy = isBuy ? effectiveBuyPrice : oppositeTrade.price_buy;
                tradeData.completed = true;
            } else {
                activeTrades.push(tradeData);
            }

            localStorage.setItem('trades', JSON.stringify(activeTrades));
            if (type === 'usStocks') updateUSStocksSection();
            else if (type === 'intraday') updateIntradaySection();
            else updateHoldingSection();
            updateActivitySection();
            closeTradePanel(new Event('click'));
            hideLoader();
        } else {
            alert('Failed to fetch latest price.');
            hideLoader();
        }
    }).catch(error => {
        console.error(`Error in handleTradeSubmit for ${stockSymbol}:`, error);
        alert('Error submitting trade. Please try again.');
        hideLoader();
    });
}

// Trade sections
function updateIntradaySection() {
    const activitySection = document.getElementById('intradayActivity');
    activitySection.innerHTML = '';

    const intradayTrades = activeTrades.filter(t => t.type === 'intraday' && !t.completed);
    if (intradayTrades.length === 0) {
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No open intraday trades.</div>';
        updateIntradaySummary(0, 0, 0);
        return;
    }

    const allExitButton = document.createElement('div');
    allExitButton.className = 'w-full flex justify-end mb-4';
    allExitButton.innerHTML = `<button class="exit-all-btn" onclick="exitAllIntradayTrades()">Exit All Trades</button>`;
    activitySection.appendChild(allExitButton);

    let totalInvested = 0;
    let totalCurrent = 0;
    let totalPnL = 0;

    const tradesBySymbol = {};
    intradayTrades.forEach(trade => {
        if (!tradesBySymbol[trade.symbol]) {
            tradesBySymbol[trade.symbol] = {
                symbol: trade.symbol,
                stock_name: trade.stock_name,
                buyQuantity: 0,
                sellQuantity: 0,
                totalBuyAmount: 0,
                totalSellAmount: 0,
                totalStopLoss: 0,
                totalTargetProfit: 0,
                tradeCount: 0,
                currentPrice: trade.currentPrice,
                timestamp: trade.timestamp,
                buyAtPrice: trade.buyAtPrice || 0,
                action: trade.action
            };
        }
        if (trade.action === 'BUY') {
            tradesBySymbol[trade.symbol].buyQuantity += trade.quantity;
            tradesBySymbol[trade.symbol].totalBuyAmount += trade.quantity * trade.price_buy;
            tradesBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
        } else {
            tradesBySymbol[trade.symbol].sellQuantity += trade.quantity;
            tradesBySymbol[trade.symbol].totalSellAmount += trade.quantity * trade.price_sell;
            tradesBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].action = 'SELL';
        }
        tradesBySymbol[trade.symbol].tradeCount += 1;
        tradesBySymbol[trade.symbol].currentPrice = trade.currentPrice;
    });

    Object.values(tradesBySymbol).forEach(trade => {
        const netQuantity = trade.buyQuantity - trade.sellQuantity;
        const isShortSell = trade.sellQuantity > trade.buyQuantity || (trade.sellQuantity > 0 && trade.buyQuantity === 0);
        const longQuantity = Math.max(0, netQuantity);
        const shortQuantity = Math.max(0, trade.sellQuantity - trade.buyQuantity);
        const longInvested = trade.totalBuyAmount;
        const shortInvested = trade.totalSellAmount;
        const invested = isShortSell ? shortInvested : longInvested;
        const avgBuyPrice = longQuantity > 0 ? longInvested / longQuantity : 0;
        const avgSellPrice = shortQuantity > 0 ? shortInvested / shortQuantity : 0;
        const avgPrice = isShortSell ? avgSellPrice : avgBuyPrice;
        const avgStopLoss = trade.totalStopLoss / (isShortSell ? shortQuantity : longQuantity) || 0;
        const avgTargetProfit = trade.totalTargetProfit / (isShortSell ? shortQuantity : longQuantity) || 0;

        let pnl = 0;
        let currentValue = 0;
        if (isShortSell) {
            currentValue = shortQuantity * trade.currentPrice;
            pnl = shortInvested - currentValue;
        } else {
            currentValue = longQuantity * trade.currentPrice;
            pnl = currentValue - longInvested;
        }

        totalInvested += invested;
        totalCurrent += currentValue;
        totalPnL += pnl;

        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        stockItem.innerHTML = `
            <div>
                <div class="stock-name">${trade.stock_name} ${isShortSell ? '(Short)' : ''}</div>
                <div class="stock-quantity">${Math.abs(netQuantity)} qty | Avg: ₹${avgPrice.toFixed(2)}</div>
                <div class="text-xs text-gray-400">
                    Avg SL: ${trade.totalStopLoss > 0 ? '₹' + avgStopLoss.toFixed(2) : 'Not Set'} | 
                    Avg TP: ${trade.totalTargetProfit > 0 ? '₹' + avgTargetProfit.toFixed(2) : 'Not Set'} | 
                    ${isShortSell ? 'Sold At' : 'Buy At'}: ${trade.buyAtPrice > 0 ? '₹' + trade.buyAtPrice.toFixed(2) : 'Market'}
                </div>
            </div>
            <div class="stock-price">
                <div>₹${trade.currentPrice.toFixed(2)}</div>
                <div class="${pnl >= 0 ? 'profit' : 'loss'}">
                    ${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${(invested > 0 ? (pnl / invested * 100).toFixed(2) : '0.00')}%)
                </div>
            </div>
            <div class="flex gap-2">
                <div class="exit-btn" onclick="exitTrade('${trade.symbol}', '${trade.timestamp}', 'intraday')">
                    Exit
                </div>
                <div class="edit-btn" onclick="editTradeLimits('${trade.symbol}', 'intraday')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
            </div>`;
        activitySection.appendChild(stockItem);
    });

    localStorage.setItem('trades', JSON.stringify(activeTrades));
    updateIntradaySummary(totalInvested, totalCurrent, totalPnL);
}

function updateHoldingSection() {
    const activitySection = document.getElementById('holdingActivity');
    activitySection.innerHTML = '';

    const holdingTrades = activeTrades.filter(t => t.type === 'holding' && !t.completed);
    if (holdingTrades.length === 0) {
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No holdings yet.</div>';
        updateHoldingSummary(0, 0, 0);
        return;
    }

    const allExitButton = document.createElement('div');
    allExitButton.className = 'w-full flex justify-end mb-4';
    allExitButton.innerHTML = `<button class="exit-all-btn" onclick="exitAllHoldings()">Exit All Holdings</button>`;
    activitySection.appendChild(allExitButton);

    let totalInvested = 0;
    let totalCurrent = 0;
    let totalPnL = 0;

    const holdingsBySymbol = {};
    holdingTrades.forEach(trade => {
        if (!holdingsBySymbol[trade.symbol]) {
            holdingsBySymbol[trade.symbol] = {
                symbol: trade.symbol,
                stock_name: trade.stock_name,
                buyQuantity: 0,
                sellQuantity: 0,
                totalBuyAmount: 0,
                totalSellAmount: 0,
                totalStopLoss: 0,
                totalTargetProfit: 0,
                tradeCount: 0,
                currentPrice: trade.currentPrice,
                timestamp: trade.timestamp,
                buyAtPrice: trade.buyAtPrice || 0,
                action: trade.action
            };
        }
        if (trade.action === 'BUY') {
            holdingsBySymbol[trade.symbol].buyQuantity += trade.quantity;
            holdingsBySymbol[trade.symbol].totalBuyAmount += trade.quantity * trade.price_buy;
            holdingsBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            holdingsBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
        } else {
            holdingsBySymbol[trade.symbol].sellQuantity += trade.quantity;
            holdingsBySymbol[trade.symbol].totalSellAmount += trade.quantity * trade.price_sell;
            holdingsBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            holdingsBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
            holdingsBySymbol[trade.symbol].action = 'SELL';
        }
        holdingsBySymbol[trade.symbol].tradeCount += 1;
        holdingsBySymbol[trade.symbol].currentPrice = trade.currentPrice;
    });

    Object.values(holdingsBySymbol).forEach(trade => {
        const netQuantity = trade.buyQuantity - trade.sellQuantity;
        const isShortSell = trade.sellQuantity > trade.buyQuantity || (trade.sellQuantity > 0 && trade.buyQuantity === 0);
        const longQuantity = Math.max(0, netQuantity);
        const shortQuantity = Math.max(0, trade.sellQuantity - trade.buyQuantity);
        const longInvested = trade.totalBuyAmount;
        const shortInvested = trade.totalSellAmount;
        const invested = isShortSell ? shortInvested : longInvested;
        const avgBuyPrice = longQuantity > 0 ? longInvested / longQuantity : 0;
        const avgSellPrice = shortQuantity > 0 ? shortInvested / shortQuantity : 0;
        const avgPrice = isShortSell ? avgSellPrice : avgBuyPrice;
        const avgStopLoss = trade.totalStopLoss / (isShortSell ? shortQuantity : longQuantity) || 0;
        const avgTargetProfit = trade.totalTargetProfit / (isShortSell ? shortQuantity : longQuantity) || 0;

        let pnl = 0;
        let currentValue = 0;
        if (isShortSell) {
            currentValue = shortQuantity * trade.currentPrice;
            pnl = shortInvested - currentValue;
        } else {
            currentValue = longQuantity * trade.currentPrice;
            pnl = currentValue - longInvested;
        }

        totalInvested += invested;
        totalCurrent += currentValue;
        totalPnL += pnl;

        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        stockItem.innerHTML = `
            <div>
                <div class="stock-name">${trade.stock_name} ${isShortSell ? '(Short)' : ''}</div>
                <div class="stock-quantity">${Math.abs(netQuantity)} qty | Avg: ₹${avgPrice.toFixed(2)}</div>
                <div class="text-xs text-gray-400">
                    Avg SL: ${trade.totalStopLoss > 0 ? '₹' + avgStopLoss.toFixed(2) : 'Not Set'} | 
                    Avg TP: ${trade.totalTargetProfit > 0 ? '₹' + avgTargetProfit.toFixed(2) : 'Not Set'} | 
                    ${isShortSell ? 'Sold At' : 'Buy At'}: ${trade.buyAtPrice > 0 ? '₹' + trade.buyAtPrice.toFixed(2) : 'Market'}
                </div>
            </div>
            <div class="stock-price">
                <div>₹${trade.currentPrice.toFixed(2)}</div>
                <div class="${pnl >= 0 ? 'profit' : 'loss'}">
                    ${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${(invested > 0 ? (pnl / invested * 100).toFixed(2) : '0.00')}%)
                </div>
            </div>
            <div class="flex gap-2">
                <div class="exit-btn" onclick="exitTrade('${trade.symbol}', '${trade.timestamp}', 'holding')">
                    Exit
                </div>
                <div class="edit-btn" onclick="editTradeLimits('${trade.symbol}', 'holding')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
            </div>`;
        activitySection.appendChild(stockItem);
    });

    localStorage.setItem('trades', JSON.stringify(activeTrades));
    updateHoldingSummary(totalInvested, totalCurrent, totalPnL);
}

function updateUSStocksSection() {
    const activitySection = document.getElementById('usStocksActivity');
    activitySection.innerHTML = '';

    const usStocksTrades = activeTrades.filter(t => t.type === 'usStocks' && !t.completed);
    if (usStocksTrades.length === 0) {
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No US stocks yet.</div>';
        updateUSStocksSummary(0, 0, 0);
        return;
    }

    const allExitButton = document.createElement('div');
    allExitButton.className = 'w-full flex justify-end mb-4';
    allExitButton.innerHTML = `<button class="exit-all-btn" onclick="exitAllUSStocks()">Exit All US Stocks</button>`;
    activitySection.appendChild(allExitButton);

    let totalInvested = 0;
    let totalCurrent = 0;
    let totalPnL = 0;

    const tradesBySymbol = {};
    usStocksTrades.forEach(trade => {
        if (!tradesBySymbol[trade.symbol]) {
            tradesBySymbol[trade.symbol] = {
                symbol: trade.symbol,
                stock_name: trade.stock_name,
                buyQuantity: 0,
                sellQuantity: 0,
                totalBuyAmount: 0,
                totalSellAmount: 0,
                totalStopLoss: 0,
                totalTargetProfit: 0,
                tradeCount: 0,
                currentPrice: trade.currentPrice,
                timestamp: trade.timestamp,
                buyAtPrice: trade.buyAtPrice || 0,
                action: trade.action
            };
        }
        if (trade.action === 'BUY') {
            tradesBySymbol[trade.symbol].buyQuantity += trade.quantity;
            tradesBySymbol[trade.symbol].totalBuyAmount += trade.quantity * trade.price_buy;
            tradesBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
        } else {
            tradesBySymbol[trade.symbol].sellQuantity += trade.quantity;
            tradesBySymbol[trade.symbol].totalSellAmount += trade.quantity * trade.price_sell;
            tradesBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
            tradesBySymbol[trade.symbol].action = 'SELL';
        }
        tradesBySymbol[trade.symbol].tradeCount += 1;
        tradesBySymbol[trade.symbol].currentPrice = trade.currentPrice;
    });

    Object.values(tradesBySymbol).forEach(trade => {
        const netQuantity = trade.buyQuantity - trade.sellQuantity;
        const isShortSell = trade.sellQuantity > trade.buyQuantity || (trade.sellQuantity > 0 && trade.buyQuantity === 0);
        const longQuantity = Math.max(0, netQuantity);
        const shortQuantity = Math.max(0, trade.sellQuantity - trade.buyQuantity);
        const longInvested = trade.totalBuyAmount;
        const shortInvested = trade.totalSellAmount;
        const invested = isShortSell ? shortInvested : longInvested;
        const avgBuyPrice = longQuantity > 0 ? longInvested / longQuantity : 0;
        const avgSellPrice = shortQuantity > 0 ? shortInvested / shortQuantity : 0;
        const avgPrice = isShortSell ? avgSellPrice : avgBuyPrice;
        const avgStopLoss = trade.totalStopLoss / (isShortSell ? shortQuantity : longQuantity) || 0;
        const avgTargetProfit = trade.totalTargetProfit / (isShortSell ? shortQuantity : longQuantity) || 0;

        let pnl = 0;
        let currentValue = 0;
        if (isShortSell) {
            currentValue = shortQuantity * trade.currentPrice;
            pnl = shortInvested - currentValue;
        } else {
            currentValue = longQuantity * trade.currentPrice;
            pnl = currentValue - longInvested;
        }

        totalInvested += invested;
        totalCurrent += currentValue;
        totalPnL += pnl;

        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        stockItem.innerHTML = `
            <div>
                <div class="stock-name">${trade.stock_name} ${isShortSell ? '(Short)' : ''}</div>
                <div class="stock-quantity">${Math.abs(netQuantity)} qty | Avg: $${avgPrice.toFixed(2)}</div>
                <div class="text-xs text-gray-400">
                    Avg SL: ${trade.totalStopLoss > 0 ? '$' + avgStopLoss.toFixed(2) : 'Not Set'} | 
                    Avg TP: ${trade.totalTargetProfit > 0 ? '$' + avgTargetProfit.toFixed(2) : 'Not Set'} | 
                    ${isShortSell ? 'Sold At' : 'Buy At'}: ${trade.buyAtPrice > 0 ? '$' + trade.buyAtPrice.toFixed(2) : 'Market'}
                </div>
            </div>
            <div class="stock-price">
                <div>$${trade.currentPrice.toFixed(2)}</div>
                <div class="${pnl >= 0 ? 'profit' : 'loss'}">
                    ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)} (${(invested > 0 ? (pnl / invested * 100).toFixed(2) : '0.00')}%)
                </div>
            </div>
            <div class="flex gap-2">
                <div class="exit-btn" onclick="exitTrade('${trade.symbol}', '${trade.timestamp}', 'usStocks')">
                    Exit
                </div>
                <div class="edit-btn" onclick="editTradeLimits('${trade.symbol}', 'usStocks')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
            </div>`;
        activitySection.appendChild(stockItem);
    });

    localStorage.setItem('trades', JSON.stringify(activeTrades));
    updateUSStocksSummary(totalInvested, totalCurrent, totalPnL);
}

function updateActivitySection() {
    const activitySection = document.getElementById('activityList');
    activitySection.innerHTML = '';

    if (activeTrades.length === 0) {
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No activity yet.</div>';
        updateActivitySummary(0, 0, 0);
        return;
    }

    activeTrades.forEach(trade => {
        const isCompleted = trade.completed;
        const isShortSell = trade.action === 'SELL';
        const isUSStock = trade.type === 'usStocks';
        const currency = isUSStock ? '$' : '₹';
        const badgeClass = isCompleted ? 'badge-complete' : (trade.action === 'BUY' ? 'badge-buy' : 'badge-sell');
        const badgeText = isCompleted ? (isShortSell ? 'Short Sell (buy)' : 'COMPLETED') : trade.action;

        const invested = isShortSell ? (trade.price_sell * trade.quantity) : (trade.price_buy * trade.quantity);
        const sold = isShortSell ? (trade.price_buy ? trade.price_buy * trade.quantity : 0) : (trade.price_sell ? trade.price_sell * trade.quantity : 0);
        const currentValue = trade.quantity * trade.currentPrice;
        const pnl = isCompleted ? (isShortSell ? (invested - sold) : (sold - invested)) : (isShortSell ? (invested - currentValue) : (currentValue - invested));
        const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00';

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-header flex justify-between items-center">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="stock-name truncate max-w-[200px]">${trade.stock_name}</span>
                    <span class="${badgeClass}">${badgeText}</span>
                </div>
                <span class="text-sm text-gray-400 flex-shrink-0">${new Date(trade.timestamp).toLocaleString('en-IN', { timeZone: isUSStock ? 'America/New_York' : 'Asia/Kolkata' })} ${trade.exitReason ? '(' + trade.exitReason + ')' : ''}</span>
            </div>
            <div class="activity-details">
                <div class="activity-detail">
                    <span class="activity-label">Quantity</span>
                    <span class="activity-value">${trade.quantity}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isShortSell ? 'Sell Price' : 'Buy Price'}</span>
                    <span class="activity-value">${currency}${(isShortSell ? trade.price_sell : trade.price_buy).toFixed(2)}</span>
                </div>
                ${isCompleted ? `
                    <div class="activity-detail">
                        <span class="activity-label">${isShortSell ? 'Exit Price (Buy)' : 'Sell Price'}</span>
                        <span class="activity-value">${currency}${(isShortSell ? trade.price_buy : trade.price_sell).toFixed(2)}</span>
                    </div>
                ` : `
                    <div class="activity-detail">
                        <span class="activity-label">Current Price</span>
                        <span class="activity-value">${currency}${trade.currentPrice.toFixed(2)}</span>
                    </div>
                `}
                <div class="activity-detail">
                    <span class="activity-label">Stop Loss</span>
                    <span class="activity-value">${trade.stopLoss > 0 ? currency + trade.stopLoss.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">Target Profit</span>
                    <span class="activity-value">${trade.targetProfit > 0 ? currency + trade.targetProfit.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isShortSell ? 'Sold At' : 'Buy At'}</span>
                    <span class="activity-value">${trade.buyAtPrice > 0 ? currency + trade.buyAtPrice.toFixed(2) : 'Market'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isCompleted ? 'Total P/L' : 'Unrealized P/L'}</span>
                    <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}${currency}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">Exit Reason</span>
                    <span class="activity-value">${trade.exitReason || 'Manual Exit'}</span>
                </div>
            </div>`;
        activitySection.appendChild(activityItem);
    });

    const totalTrades = activeTrades.length;
    const completedTrades = activeTrades.filter(t => t.completed).length;
    const netPL = activeTrades.reduce((sum, trade) => {
        if (trade.completed) {
            const isShort = trade.action === 'SELL';
            const buyAmount = trade.price_buy * trade.quantity;
            const sellAmount = trade.price_sell * trade.quantity;
            return sum + (isShort ? (sellAmount - buyAmount) : (sellAmount - buyAmount));
        }
        return sum;
    }, 0);
    const totalInvested = activeTrades.reduce((sum, trade) => sum + ((trade.action === 'BUY' ? trade.price_buy : trade.price_sell) * trade.quantity), 0);
    const netPLPercentage = totalInvested > 0 ? ((netPL / totalInvested) * 100).toFixed(2) : 0;

    updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage);
}

// Summary updates
function updateIntradaySummary(invested, current, pnl) {
    const investedEl = document.querySelector('#intraday .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#intraday .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#intraday .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace('₹', '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace('₹', '')) || 0;

    animateValue(investedEl, prevInvested, invested, 300, '₹');
    animateValue(currentEl, prevCurrent, current, 300, '₹');

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    const sign = pnl >= 0 ? '+' : '-';
    pnlEl.textContent = `₹${sign}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;
    pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
    pnlEl.classList.add('number-animate');
    setTimeout(() => pnlEl.classList.remove('number-animate'), 300);
}

function updateHoldingSummary(invested, current, pnl) {
    const investedEl = document.querySelector('#holding .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#holding .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#holding .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace('₹', '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace('₹', '')) || 0;

    animateValue(investedEl, prevInvested, invested, 300, '₹');
    animateValue(currentEl, prevCurrent, current, 300, '₹');

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    const sign = pnl >= 0 ? '+' : '-';
    pnlEl.textContent = `₹${sign}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;
    pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
    pnlEl.classList.add('number-animate');
    setTimeout(() => pnlEl.classList.remove('number-animate'), 300);
}

function updateUSStocksSummary(invested, current, pnl) {
    const investedEl = document.querySelector('#usStocks .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#usStocks .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#usStocks .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace('$', '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace('$', '')) || 0;

    animateValue(investedEl, prevInvested, invested, 300, '$');
    animateValue(currentEl, prevCurrent, current, 300, '$');

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    const sign = pnl >= 0 ? '+' : '-';
    pnlEl.textContent = `$${sign}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;
    pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
    pnlEl.classList.add('number-animate');
    setTimeout(() => pnlEl.classList.remove('number-animate'), 300);
}

function updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage) {
    document.querySelector('#activity .info-section span:nth-child(1) b:last-child').textContent = totalTrades;
    document.querySelector('#activity .info-section span:nth-child(2) b:last-child').textContent = completedTrades;
    const pnlElement = document.querySelector('#activity .info-section span:nth-child(3) b:last-child');
    const currency = netPL >= 0 ? '+' : '-';
    pnlElement.textContent = `₹${Math.abs(netPL).toFixed(2)} (${netPLPercentage}%)`; // Using INR for activity summary
    pnlElement.className = netPL >= 0 ? 'profit mt-1' : 'loss mt-1';
}

// Trade actions
function exitTrade(symbol, timestamp, type) {
    if (!isSignedIn) {
        alert('Please sign in to exit trades.');
        toggleSignInOverlay();
        return;
    }
    const isUSStock = type === 'usStocks';
    const isMarketActive = isUSStock ? isUSMarketOpen() : isMarketOpen();
    if (!isMarketActive) {
        alert(`Market is closed! Can only exit trades between ${isUSStock ? '9:30 AM and 4:00 PM EST' : '9:15 AM and 3:30 PM IST'}`);
        return;
    }

    if (confirm('Are you sure you want to exit this trade?')) {
        let tradesExited = 0;
        if (timestamp) {
            const trade = activeTrades.find(t => t.symbol === symbol && t.timestamp === timestamp && !t.completed);
            if (trade) {
                trade.completed = true;
                if (trade.action === 'SELL') {
                    trade.price_buy = trade.currentPrice;
                } else {
                    trade.price_sell = trade.currentPrice;
                }
                trade.timestamp_close = new Date().toISOString();
                trade.exitReason = trade.exitReason || 'Manual Exit';
                tradesExited = 1;
            }
        } else {
            const trades = activeTrades.filter(t => t.symbol === symbol && t.type === type && !t.completed);
            trades.forEach(trade => {
                trade.completed = true;
                if (trade.action === 'SELL') {
                    trade.price_buy = trade.currentPrice;
                } else {
                    trade.price_sell = trade.currentPrice;
                }
                trade.timestamp_close = new Date().toISOString();
                trade.exitReason = trade.exitReason || 'Manual Exit';
            });
            tradesExited = trades.length;
        }
        if (tradesExited > 0) {
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            if (type === 'usStocks') updateUSStocksSection();
            else if (type === 'intraday') updateIntradaySection();
            else updateHoldingSection();
            updateActivitySection();
            alert(`${tradesExited} trade${tradesExited > 1 ? 's' : ''} exited successfully!`);
        } else {
            alert('No trades found to exit.');
        }
    }
}

function exitAllIntradayTrades() {
    if (!isSignedIn) {
        alert('Please sign in to exit trades.');
        toggleSignInOverlay();
        return;
    }
    if (!isMarketOpen()) {
        alert('Market is closed! Can only exit trades between 9:15 AM and 3:30 PM IST');
        return;
    }
    if (!confirm('Are you sure you want to exit all intraday trades?')) {
        return;
    }
    const intradayTrades = activeTrades.filter(t => t.type === 'intraday' && !t.completed);
    if (intradayTrades.length === 0) {
        alert('No open intraday trades to exit.');
        return;
    }
    intradayTrades.forEach(trade => {
        trade.completed = true;
        if (trade.action === 'SELL') {
            trade.price_buy = trade.currentPrice;
        } else {
            trade.price_sell = trade.currentPrice;
        }
        trade.timestamp_close = new Date().toISOString();
        trade.exitReason = trade.exitReason || 'Manual Exit';
    });
    localStorage.setItem('trades', JSON.stringify(activeTrades));
    alert(`${intradayTrades.length} intraday trades exited successfully!`);
    updateIntradaySection();
    updateActivitySection();
}

function exitAllHoldings() {
    if (!isSignedIn) {
        alert('Please sign in to exit trades.');
        toggleSignInOverlay();
        return;
    }
    if (!isMarketOpen()) {
        alert('Market is closed! Can only exit trades between 9:15 AM and 3:30 PM IST');
        return;
    }
    if (!confirm('Are you sure you want to exit all holdings?')) {
        return;
    }
    const holdingTrades = activeTrades.filter(t => t.type === 'holding' && !t.completed);
    if (holdingTrades.length === 0) {
        alert('No open holdings to exit.');
        return;
    }
    holdingTrades.forEach(trade => {
        trade.completed = true;
        if (trade.action === 'SELL') {
            trade.price_buy = trade.currentPrice;
        } else {
            trade.price_sell = trade.currentPrice;
        }
        trade.timestamp_close = new Date().toISOString();
        trade.exitReason = trade.exitReason || 'Manual Exit';
    });
    localStorage.setItem('trades', JSON.stringify(activeTrades));
    alert(`${holdingTrades.length} holdings exited successfully!`);
    updateHoldingSection();
    updateActivitySection();
}

function exitAllUSStocks() {
    if (!isSignedIn) {
        alert('Please sign in to exit trades.');
        toggleSignInOverlay();
        return;
    }
    if (!isUSMarketOpen()) {
        alert('US market is closed! Can only exit trades between 9:30 AM and 4:00 PM EST');
        return;
    }
    if (!confirm('Are you sure you want to exit all US stock trades?')) {
        return;
    }
    const usStocksTrades = activeTrades.filter(t => t.type === 'usStocks' && !t.completed);
    if (usStocksTrades.length === 0) {
        alert('No open US stock trades to exit.');
        return;
    }
    usStocksTrades.forEach(trade => {
        trade.completed = true;
        if (trade.action === 'SELL') {
            trade.price_buy = trade.currentPrice;
        } else {
            trade.price_sell = trade.currentPrice;
        }
        trade.timestamp_close = new Date().toISOString();
        trade.exitReason = trade.exitReason || 'Manual Exit';
    });
    localStorage.setItem('trades', JSON.stringify(activeTrades));
    alert(`${usStocksTrades.length} US stock trades exited successfully!`);
    updateUSStocksSection();
    updateActivitySection();
}

function editTradeLimits(symbol, type) {
    if (!isSignedIn) {
        alert('Please sign in to edit trades.');
        toggleSignInOverlay();
        return;
    }
    const tradesToEdit = activeTrades.filter(t => t.type === type && t.symbol === symbol && !t.completed);
    if (tradesToEdit.length === 0) {
        alert(`No active ${type} trades found for this stock.`);
        return;
    }
    const currency = type === 'usStocks' ? '$' : '₹';
    const newStopLoss = prompt(`Enter new Stop Loss for ${symbol} (Current: ${tradesToEdit[0].stopLoss ? currency + tradesToEdit[0].stopLoss.toFixed(2) : 'Not Set'})`, tradesToEdit[0].stopLoss || '');
    const newTargetProfit = prompt(`Enter new Target Profit for ${symbol} (Current: ${tradesToEdit[0].targetProfit ? currency + tradesToEdit[0].targetProfit.toFixed(2) : 'Not Set'})`, tradesToEdit[0].targetProfit || '');
    if (newStopLoss !== null && newTargetProfit !== null) {
        const stopLossValue = parseFloat(newStopLoss) || 0;
        const targetProfitValue = parseFloat(newTargetProfit) || 0;
        tradesToEdit.forEach(trade => {
            trade.stopLoss = stopLossValue;
            trade.targetProfit = targetProfitValue;
        });
        localStorage.setItem('trades', JSON.stringify(activeTrades));
        if (type === 'usStocks') updateUSStocksSection();
        else if (type === 'intraday') updateIntradaySection();
        else updateHoldingSection();
        updateActivitySection();
        alert(`Updated SL and TP for ${symbol} (${type})`);
    }
}

function deleteTrade(symbol, timestamp) {
    if (!isSignedIn) {
        alert('Please sign in to delete trades.');
        toggleSignInOverlay();
        return;
    }
    if (confirm('Are you sure you want to delete this trade?')) {
        const index = activeTrades.findIndex(t => t.symbol === symbol && t.timestamp === timestamp);
        if (index !== -1) {
            activeTrades.splice(index, 1);
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateHoldingSection();
            updateUSStocksSection();
            updateActivitySection();
            alert('Trade deleted successfully!');
        }
    }
}

// Price updates
function startPriceUpdates() {
    setInterval(async () => {
        if (!isMarketOpen() && !isUSMarketOpen()) return;

        let pricesUpdated = false;
        const uniqueSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];

        for (const symbol of uniqueSymbols) {
            try {
                const trade = activeTrades.find(t => t.symbol === symbol);
                const marketType = trade?.type === 'usStocks' ? 'usStocks' : 'indian';
                const isMarketActive = marketType === 'usStocks' ? isUSMarketOpen() : isMarketOpen();
                if (!isMarketActive) continue;

                const price = await fetchLatestPrice(symbol, marketType);
                if (price > 0) {
                    activeTrades.forEach(trade => {
                        if (trade.symbol === symbol) {
                            trade.currentPrice = price;
                            pricesUpdated = true;

                            if (isMarketActive && !trade.completed) {
                                if (trade.action === 'BUY') {
                                    if (trade.stopLoss > 0 && price <= trade.stopLoss) {
                                        trade.completed = true;
                                        trade.price_sell = price;
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Stop Loss Hit';
                                        console.log(`${trade.stock_name} SL hit at ${trade.currency === 'USD' ? '$' : '₹'}${price}`);
                                    } else if (trade.targetProfit > 0 && price >= trade.targetProfit) {
                                        trade.completed = true;
                                        trade.price_sell = price;
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Target Profit Hit';
                                        console.log(`${trade.stock_name} TP hit at ${trade.currency === 'USD' ? '$' : '₹'}${price}`);
                                    }
                                } else if (trade.action === 'SELL') {
                                    if (trade.stopLoss > 0 && price >= trade.stopLoss) {
                                        trade.completed = true;
                                        trade.price_buy = price;
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Stop Loss Hit (Short)';
                                        console.log(`${trade.stock_name} SL hit (short) at ${trade.currency === 'USD' ? '$' : '₹'}${price}`);
                                    } else if (trade.targetProfit > 0 && price <= trade.targetProfit) {
                                        trade.completed = true;
                                        trade.price_buy = price;
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Target Profit Hit (Short)';
                                        console.log(`${trade.stock_name} TP hit (short) at ${trade.currency === 'USD' ? '$' : '₹'}${price}`);
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (error) {
                console.error(`Failed to update price for ${symbol}:`, error);
            }
        }

        if (pricesUpdated) {
            updateIntradaySection();
            updateHoldingSection();
            updateUSStocksSection();
            updateActivitySection();
            localStorage.setItem('trades', JSON.stringify(activeTrades));
        }

        checkIntradayAutoClose();
    }, priceUpdateInterval);
}

function checkIntradayAutoClose() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const closeTime = INTRADAY_CLOSE.hours * 60 + INTRADAY_CLOSE.minutes;

    if (currentTime >= closeTime) {
        let tradesClosed = 0;
        activeTrades.forEach(trade => {
            if (trade.type === 'intraday' && !trade.completed) {
                trade.completed = true;
                if (trade.action === 'SELL') {
                    trade.price_buy = trade.currentPrice;
                } else {
                    trade.price_sell = trade.currentPrice;
                }
                trade.timestamp_close = new Date().toISOString();
                trade.exitReason = 'Market Close';
                tradesClosed++;
            }
        });
        if (tradesClosed > 0) {
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateActivitySection();
            console.log(`${tradesClosed} intraday trades closed due to market close.`);
        }
    }
}

// Utilities
function formatIndianNumber(num, isPnl = false) {
    if (isPnl && num === 0) return '₹0.00';
    const absNum = Math.abs(num);
    let prefix = isPnl ? (num >= 0 ? '+₹' : '-₹') : '₹';
    if (absNum >= 10000000) {
        const croreValue = (absNum / 10000000).toFixed(2);
        return `${prefix}${croreValue} Cr`;
    } else if (absNum >= 100000) {
        const lakhValue = (absNum / 100000).toFixed(2);
        return `${prefix}${lakhValue} L`;
    } else {
        const formattedNum = absNum.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
        return `${prefix}${formattedNum}`;
    }
}

function animateValue(element, start, end, duration, prefix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = start + (end - start) * progress;
        element.textContent = `${prefix}${value.toFixed(2)}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    element.classList.add('number-animate');
    window.requestAnimationFrame(step);
    setTimeout(() => element.classList.remove('number-animate'), duration);
}

function showLoader() {
    document.getElementById('loaderContainer')?.classList.add('show');
}

function hideLoader() {
    document.getElementById('loaderContainer')?.classList.remove('show');
}

function hideSplashScreen() {
    setTimeout(() => document.getElementById('splashScreen')?.classList.add('hide-splash'), 500);
}

function openTab(tabName, element) {
    if (!isSignedIn) {
        alert('Please sign in to view tabs.');
        toggleSignInOverlay();
        return;
    }
    if (document.getElementById('searchOverlay').classList.contains('open')) return;
    showLoader();
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    setTimeout(() => {
        const activeTab = document.getElementById(tabName);
        if (activeTab) activeTab.classList.remove('hidden');
        hideLoader();
    }, 500);
}

// Search overlay (assuming it's intended but incomplete)
function toggleSearchOverlay() {
    if (!isSignedIn) {
        alert('Please sign in to search activities.');
        toggleSignInOverlay();
        return;
    }
    document.getElementById('searchOverlay').classList.toggle('open');
}

// Continuation of updateSearch function
function updateSearch(e) {
    if (!isSignedIn) {
        alert('Please sign in to search activities.');
        toggleSignInOverlay();
        return;
    }
    const message = document.getElementById('searchMessage');
    const activitySection = document.getElementById('activityList'); // Fixed ID from activityListI

    if (!e.target.value) {
        message.textContent = 'Search your activity (e.g., profit, loss, name, status)';
        activitySection.innerHTML = '';
        updateActivitySection();
        return;
    }

    const filteredTrades = activeTrades.filter(trade => {
        const invested = trade.quantity * (trade.action === 'SELL' ? trade.price_sell : trade.price_buy);
        const sold = trade.action === 'SELL' ? (trade.price_buy ? trade.price_buy * trade.quantity : 0) : (trade.price_sell ? trade.price_sell * trade.quantity : 0);
        const isCompleted = trade.completed;
        const pnl = isCompleted ? (trade.action === 'SELL' ? (invested - sold) : (sold - invested)) : (trade.action === 'SELL' ? (invested - trade.quantity * trade.currentPrice) : (trade.quantity * trade.currentPrice - invested));
        return (
            trade.symbol.toLowerCase().includes(e.target.value.toLowerCase()) ||
            trade.action.toLowerCase().includes(e.target.value.toLowerCase()) ||
            trade.stock_name.toLowerCase().includes(e.target.value.toLowerCase()) ||
            pnl.toString().includes(e.target.value) ||
            (trade.completed && 'completed'.includes(e.target.value.toLowerCase())) ||
            (trade.exitReason && trade.exitReason.toLowerCase().includes(e.target.value.toLowerCase()))
        );
    });

    activitySection.innerHTML = '';
    if (filteredTrades.length === 0) {
        message.textContent = 'No matching activities found';
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No results found.</div>';
    } else {
        message.textContent = `Found ${filteredTrades.length} matching activit${filteredTrades.length === 1 ? 'y' : 'ies'}`;
        filteredTrades.forEach(trade => {
            const isCompleted = trade.completed;
            const isShortSell = trade.action === 'SELL';
            const isUSStock = trade.type === 'usStocks';
            const currency = isUSStock ? '$' : '₹';
            const badgeClass = isCompleted ? 'badge-complete' : (trade.action === 'BUY' ? 'badge-buy' : 'badge-sell');
            const badgeText = isCompleted ? (isShortSell ? 'Short Sell (buy)' : 'COMPLETED') : trade.action;

            const invested = isShortSell ? (trade.price_sell * trade.quantity) : (trade.price_buy * trade.quantity);
            const sold = isShortSell ? (trade.price_buy ? trade.price_buy * trade.quantity : 0) : (trade.price_sell ? trade.price_sell * trade.quantity : 0);
            const currentValue = trade.quantity * trade.currentPrice;
            const pnl = isCompleted ? (isShortSell ? (invested - sold) : (sold - invested)) : (isShortSell ? (invested - currentValue) : (currentValue - invested));
            const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00';

            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-header flex justify-between items-center">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="stock-name truncate max-w-[200px]">${trade.stock_name}</span>
                        <span class="${badgeClass}">${badgeText}</span>
                    </div>
                    <span class="text-sm text-gray-400 flex-shrink-0">${new Date(trade.timestamp).toLocaleString('en-IN', { timeZone: isUSStock ? 'America/New_York' : 'Asia/Kolkata' })} ${trade.exitReason ? '(' + trade.exitReason + ')' : ''}</span>
                </div>
                <div class="activity-details">
                    <div class="activity-detail">
                        <span class="activity-label">Quantity</span>
                        <span class="activity-value">${trade.quantity}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-label">${isShortSell ? 'Sell Price' : 'Buy Price'}</span>
                        <span class="activity-value">${currency}${(isShortSell ? trade.price_sell : trade.price_buy).toFixed(2)}</span>
                    </div>
                    ${isCompleted ? `
                        <div class="activity-detail">
                            <span class="activity-label">${isShortSell ? 'Exit Price (Buy)' : 'Sell Price'}</span>
                            <span class="activity-value">${currency}${(isShortSell ? trade.price_buy : trade.price_sell).toFixed(2)}</span>
                        </div>
                    ` : `
                        <div class="activity-detail">
                            <span class="activity-label">Current Price</span>
                            <span class="activity-value">${currency}${trade.currentPrice.toFixed(2)}</span>
                        </div>
                    `}
                    <div class="activity-detail">
                        <span class="activity-label">Stop Loss</span>
                        <span class="activity-value">${trade.stopLoss > 0 ? currency + trade.stopLoss.toFixed(2) : 'Not Set'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-label">Target Profit</span>
                        <span class="activity-value">${trade.targetProfit > 0 ? currency + trade.targetProfit.toFixed(2) : 'Not Set'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-label">${isShortSell ? 'Sold At' : 'Buy At'}</span>
                        <span class="activity-value">${trade.buyAtPrice > 0 ? currency + trade.buyAtPrice.toFixed(2) : 'Market'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-label">${isCompleted ? 'Total P/L' : 'Unrealized P/L'}</span>
                        <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}${currency}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-label">Exit Reason</span>
                        <span class="activity-value">${trade.exitReason || 'Manual Exit'}</span>
                    </div>
                </div>`;
            activitySection.appendChild(activityItem);
        });
    }
}

// Event Listeners and Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI based on sign-in status
    if (isSignedIn) {
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('signInBtn').textContent = 'Sign Out';
        document.getElementById('signInBtn').onclick = handleSignOut;
    } else {
        document.getElementById('landingPage').classList.remove('hidden');
        document.getElementById('appContent').classList.add('hidden');
        document.getElementById('signInBtn').textContent = 'Sign In';
        document.getElementById('signInBtn').onclick = toggleSignInOverlay;
    }

    // Attach event listeners
    document.getElementById('signInForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignIn();
    });

    document.getElementById('stockSymbol')?.addEventListener('input', callapi);
    document.getElementById('tradeOverlay')?.addEventListener('click', closeTradePanel);

    // Trade form buttons
    document.getElementById('intradayBuyBtn')?.addEventListener('click', () => handleTradeSubmit('intraday', true));
    document.getElementById('intradaySellBtn')?.addEventListener('click', () => handleTradeSubmit('intraday', false));
    document.getElementById('holdingBuyBtn')?.addEventListener('click', () => handleTradeSubmit('holding', true));
    document.getElementById('holdingSellBtn')?.addEventListener('click', () => handleTradeSubmit('holding', false));
    document.getElementById('usStocksBuyBtn')?.addEventListener('click', () => handleTradeSubmit('usStocks', true));
    document.getElementById('usStocksSellBtn')?.addEventListener('click', () => handleTradeSubmit('usStocks', false));

    // Initialize sections
    updateIntradaySection();
    updateHoldingSection();
    updateUSStocksSection();
    updateActivitySection();

    // Start price updates
    startPriceUpdates();

    // Hide splash screen
    hideSplashScreen();
});

// Ensure search overlay close on outside click
document.getElementById('searchOverlay')?.addEventListener('click', (event) => {
    if (event.target === document.getElementById('searchOverlay')) {
        document.getElementById('searchOverlay').classList.remove('open');
    }
});

// Search input for activity
document.getElementById('searchInput')?.addEventListener('input', updateSearch);
