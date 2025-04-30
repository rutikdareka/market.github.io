let isSignedIn = localStorage.getItem('isSignedIn') === 'true';

function toggleSignInOverlay() {
    document.getElementById('signInOverlay').style.display = 'flex';
}

function handleSignIn() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username.length >= 5 && password.length >= 6) {
        isSignedIn = true;
        localStorage.setItem(`userid`, username);
        localStorage.setItem("isSignedIn", true);
        document.getElementById('signInOverlay').style.display = 'none';
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('signInBtn').textContent = 'Sign Out';
        document.getElementById('signInBtn').onclick = handleSignOut;
    } else {
        alert('atleast 5 characters for username and 6 characters for password');
    }
}

function handleSignOut() {
    isSignedIn = false;
    localStorage.setItem('isSignedIn', 'false');
    document.getElementById('landingPage').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('signInBtn').textContent = 'Sign In';
    document.getElementById('signInBtn').onclick = toggleSignInOverlay;
}

document.addEventListener('DOMContentLoaded', () => {
    if (isSignedIn) {
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('signInBtn').textContent = 'Sign Out';
        document.getElementById('signInBtn').onclick = handleSignOut;
    } else {
        document.getElementById('landingPage').classList.remove('hidden');
        document.getElementById('appContent').classList.add('hidden');
    }
});

let typingTimer;
const doneTypingInterval = 300;
const priceUpdateInterval = 1000;
let livePrices = new Map();
let liveUSPrices = new Map();
let activeTrades = [];
let activeUSTrades = JSON.parse(localStorage.getItem('trades')) || [];

const INTRADAY_OPEN = { hours: 9, minutes: 15 };
const INTRADAY_CLOSE = { hours: 15, minutes: 15 };
const HOLDING_CLOSE = { hours: 15, minutes: 30 };
const US_MARKET_OPEN = { hours: 9, minutes: 30 };
const US_MARKET_CLOSE = { hours: 16, minutes: 0 };
const FINNHUB_API_KEY = "d096t3hr01qnv9cgvshgd096t3hr01qnv9cgvsi0";
let priceUpdateIntervalId = null;
let priceUSUpdateIntervalId = null;

function callapi(e) {
    clearTimeout(typingTimer);
    const searchValue = e.target.value.trim();
    if (!searchValue) {
        document.getElementById('searchResultsContainer').classList.add('hidden');
        return;
    }
    typingTimer = setTimeout(() => fetchStockSymbols(searchValue), doneTypingInterval);
}

function callUSApi(e) {
    clearTimeout(typingTimer);
    const searchValue = e.target.value.trim();
    if (!searchValue) {
        document.getElementById('usSearchResultsContainer').classList.add('hidden');
        return;
    }
    typingTimer = setTimeout(() => fetchUSStockSymbols(searchValue), doneTypingInterval);
}

function fetchStockSymbols(query) {
    const apiUrl = `https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php?classic=true&query=${encodeURIComponent(query)}&type=1&format=json`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => displaySearchResults(data))
        .catch(error => console.error("Error fetching stock symbols:", error));
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
            li.addEventListener('click', () => selectStock(stockSymbol, stockName));
            resultsList.appendChild(li);
        });
    } else {
        resultsContainer.classList.remove('hidden');
        const li = document.createElement('li');
        li.className = 'px-4 py-2 text-gray-400';
        li.textContent = 'No matching stocks found';
        resultsList.appendChild(li);
    }
}

function fetchUSStockSymbols(query) {
    if (!FINNHUB_API_KEY || FINNHUB_API_KEY === 'YOUR_FINNHUB_API_KEY') {
        console.error('Finnhub API key is missing or invalid');
        alert('API key is not configured. Contact the administrator.');
        return Promise.resolve([]);
    }
    const apiUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`;
    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.result) throw new Error('Invalid response from Finnhub');
            displayUSSearchResults(data.result)
            return data.result;
        })
        .catch(error => {
            console.error("Error fetching US stock symbols:", error);
            alert('Failed to fetch stock symbols. Please try again later.');
            return [];
        });
}

function displayUSSearchResults(results) {
    const resultsContainer = document.getElementById('usSearchResultsContainer');
    const resultsList = document.getElementById('usSearchResults');
    resultsList.innerHTML = '';
    console.log('US Search Results:', results); // Add this to debug

    if (results && Array.isArray(results) && results.length > 0) {
        resultsContainer.classList.remove('hidden');
        results.forEach(item => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-gray-700 cursor-pointer text-white';
            const stockName = item.description || item.displaySymbol;
            const stockSymbol = item.symbol;
            li.innerHTML = `<div class="flex flex-col"><span class="font-medium truncate">${stockName} (${stockSymbol})</span></div>`;
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

async function selectStock(symbol, name, ...args) {
    const type = args[0] || (symbol.includes(':') ? 'usStocks' : 'intraday');
    const isUSStock = type === 'usStocks';
    const symbolInput = document.getElementById(isUSStock ? 'usStockSymbol' : 'stockSymbol');
    const priceInput = document.getElementById(isUSStock ? 'usPrice' : 'price');
    const resultsContainer = document.getElementById(isUSStock ? 'usSearchResultsContainer' : 'searchResultsContainer');

    symbolInput.value = symbol;
    resultsContainer.classList.add('hidden');

    try {
        showLoader();
        let price;
        if (isUSStock) {
            price = await fetchUSLatestPrice(symbol);
            priceInput.value = price > 0 ? `$${price.toFixed(2)}` : 'N/A';
            liveUSPrices.set(symbol, price);
            startUSPriceUpdateForInput(symbol, priceInput);
        } else {
            price = await fetchLatestPrice(symbol);
            priceInput.value = price > 0 ? formatIndianNumber(price) : 'N/A';
            livePrices.set(symbol, price);
            startPriceUpdateForInput(symbol, priceInput);
        }
        symbolInput.dataset.stockName = name;
    } catch (error) {
        console.error('Error in selectStock:', error);
        priceInput.value = 'N/A';
    } finally {
        hideLoader();
    }
}

function startPriceUpdateForInput(symbol, priceInput) {
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId);
    }

    priceUpdateIntervalId = setInterval(async () => {
        if (isMarketOpen()) {
            try {
                const latestPrice = await fetchLatestPrice(symbol);
                if (latestPrice > 0) {
                    priceInput.value = formatIndianNumber(latestPrice);
                    livePrices.set(symbol, latestPrice);
                }
            } catch (error) {
                console.error(`Error updating price for ${symbol}:`, error);
            }
        }
    }, 1000);
}

function startUSPriceUpdateForInput(symbol, priceInput) {
    if (priceUSUpdateIntervalId) {
        clearInterval(priceUSUpdateIntervalId);
    }
    priceUSUpdateIntervalId = setInterval(() => {
        if (isUSMarketOpen()) {
            fetchUSLatestPrice(symbol)
                .then(latestPrice => {
                    if (latestPrice > 0) {
                        priceInput.value = `$${latestPrice.toFixed(2)}`;
                        liveUSPrices.set(symbol, latestPrice);
                    } else {
                        priceInput.value = priceInput.value || '$0.00'; // Keep last value if fetch fails
                    }
                })
                .catch(error => {
                    console.error(`Error updating price for ${symbol}:`, error);
                    priceInput.value = priceInput.value || '$0.00'; // Keep last value on error
                });
        } else {
            priceInput.value = `${priceInput.value || '$0.00'} (Market Closed)`;
        }
    }, 5000); // Increased to 5 seconds to avoid rate limits
}

function startPriceUpdates() {
    setInterval(() => {
        // Update Indian Stocks
        if (isMarketOpen()) {
            let pricesUpdated = false;
            const uniqueSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];

            for (const symbol of uniqueSymbols) {
                fetchLatestPrice(symbol)
                    .then(price => {
                        if (price > 0) {
                            activeTrades.forEach(trade => {
                                if (trade.symbol === symbol) {
                                    trade.currentPrice = price;
                                    pricesUpdated = true;

                                    if (isMarketOpen() && !trade.completed) {
                                        if (trade.action === 'BUY') {
                                            if (trade.stopLoss > 0 && price <= trade.stopLoss) {
                                                trade.completed = true;
                                                trade.price_sell = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Stop Loss Hit';
                                                console.log(`${trade.stock_name} SL hit at ₹${price}`);
                                            } else if (trade.targetProfit > 0 && price >= trade.targetProfit) {
                                                trade.completed = true;
                                                trade.price_sell = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Target Profit Hit';
                                                console.log(`${trade.stock_name} TP hit at ₹${price}`);
                                            }
                                        } else if (trade.action === 'SELL') {
                                            if (trade.stopLoss > 0 && price >= trade.stopLoss) {
                                                trade.completed = true;
                                                trade.price_buy = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Stop Loss Hit (Short)';
                                                console.log(`${trade.stock_name} SL hit (short) at ₹${price}`);
                                            } else if (trade.targetProfit > 0 && price <= trade.targetProfit) {
                                                trade.completed = true;
                                                trade.price_buy = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Target Profit Hit (Short)';
                                                console.log(`${trade.stock_name} TP hit (short) at ₹${price}`);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Failed to update price for ${symbol}:`, error);
                    });
            } // <-- this was the missing closing brace

            if (pricesUpdated) {
                updateIntradaySection();
                updateHoldingSection();
                updateActivitySection();
                localStorage.setItem('trades', JSON.stringify(activeTrades));
            }

            checkIntradayAutoClose();
        }

        // Update US Stocks
        if (isUSMarketOpen()) {
            let usPricesUpdated = false;
            const uniqueUSSymbols = [...new Set(activeUSTrades.map(trade => trade.symbol))];

            for (const symbol of uniqueUSSymbols) {
                fetchUSLatestPrice(symbol)
                    .then(price => {
                        if (price > 0) {
                            activeUSTrades.forEach(trade => {
                                if (trade.symbol === symbol) {
                                    trade.currentPrice = price;
                                    usPricesUpdated = true;

                                    if (isUSMarketOpen() && !trade.completed) {
                                        if (trade.action === 'BUY') {
                                            if (trade.stopLoss > 0 && price <= trade.stopLoss) {
                                                trade.completed = true;
                                                trade.price_sell = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Stop Loss Hit';
                                                console.log(`${trade.stock_name} SL hit at $${price}`);
                                            } else if (trade.targetProfit > 0 && price >= trade.targetProfit) {
                                                trade.completed = true;
                                                trade.price_sell = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Target Profit Hit';
                                                console.log(`${trade.stock_name} TP hit at $${price}`);
                                            }
                                        } else if (trade.action === 'SELL') {
                                            if (trade.stopLoss > 0 && price >= trade.stopLoss) {
                                                trade.completed = true;
                                                trade.price_buy = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Stop Loss Hit (Short)';
                                                console.log(`${trade.stock_name} SL hit (short) at $${price}`);
                                            } else if (trade.targetProfit > 0 && price <= trade.targetProfit) {
                                                trade.completed = true;
                                                trade.price_buy = price;
                                                trade.timestamp_close = new Date().toISOString();
                                                trade.exitReason = 'Target Profit Hit (Short)';
                                                console.log(`${trade.stock_name} TP hit (short) at $${price}`);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Failed to update US price for ${symbol}:`, error);
                    });
            }

            if (usPricesUpdated) {
                updateUSStocksSection();
                updateActivitySection();
                localStorage.setItem('trades', JSON.stringify(activeUSTrades));
            }
        }
    }, priceUpdateInterval);
}


document.addEventListener('click', (e) => {
    if (!e.target.closest('#stockSymbol') && !e.target.closest('#searchResultsContainer')) {
        document.getElementById('searchResultsContainer').classList.add('hidden');
    }
    if (!e.target.closest('#usStockSymbol') && !e.target.closest('#usSearchResultsContainer')) {
        document.getElementById('usSearchResultsContainer').classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (isSignedIn) {
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('signInBtn').textContent = 'Sign Out';
        document.getElementById('signInBtn').onclick = handleSignOut;
    } else {
        document.getElementById('landingPage').classList.remove('hidden');
        document.getElementById('appContent').classList.add('hidden');
    }
    hideSplashScreen();
    startPriceUpdates();
    activeTrades = JSON.parse(localStorage.getItem('trades') || '[]');
    updateIntradaySection();
    updateHoldingSection();
    updateUSStocksSection();
    updateActivitySection();
});

function hideSplashScreen() {
    setTimeout(() => document.getElementById('splashScreen')?.classList.add('hide-splash'), 500);
}

function showLoader() { document.getElementById('loaderContainer')?.classList.add('show'); }
function hideLoader() { document.getElementById('loaderContainer')?.classList.remove('show'); }

function openTab(tabName, element) {
    if (document.getElementById("searchOverlay").classList.contains("open")) return;
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

function toggleSearchOverlay() { document.getElementById("searchOverlay").classList.toggle("open"); }

function updateSearch(e) {
    const message = document.getElementById("searchMessage");
    const activitySection = document.getElementById('activityListI');

    if (!e.target.value) {
        message.textContent = "Search your activity ex (profit,loss,name,status)";
        activitySection.innerHTML = "";
        return;
    }

    const filteredTrades = activeTrades.filter(trade => {
        const invested = trade.quantity * trade.price_buy;
        const sold = trade.price_sell ? trade.quantity * trade.price_sell : 0;
        const isCompleted = trade.completed;
        const pnl = isCompleted ? sold - invested : (trade.quantity * trade.currentPrice - invested);

        return (
            trade.symbol.toLowerCase().includes(e.target.value.toLowerCase()) ||
            trade.action.toLowerCase().includes(e.target.value.toLowerCase()) ||
            pnl.toString().includes(e.target.value) ||
            (trade.completed && 'completed'.includes(e.target.value.toLowerCase()))
        );
    });

    activitySection.innerHTML = "";

    if (filteredTrades.length === 0) {
        message.textContent = "No matching activities found";
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No results found.</div>';
    } else {
        message.textContent = `Found ${filteredTrades.length} matching activit${filteredTrades.length === 1 ? 'y' : 'ies'}`;
        filteredTrades.forEach(trade => {
            const isCompleted = trade.completed;
            const badgeClass = isCompleted ? 'badge-complete' : (trade.action === 'BUY' ? 'badge-buy' : 'badge-sell');
            const badgeText = isCompleted ? 'COMPLETED' : trade.action;

            const invested = trade.quantity * trade.price_buy;
            const sold = trade.price_sell ? trade.quantity * trade.price_sell : 0;
            const pnl = isCompleted ? sold - invested : (trade.quantity * trade.currentPrice - invested);
            const pnlPercentage = ((pnl / invested) * 100).toFixed(2);

            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                    <div class="activity-header">
                        <div class="flex items-center gap-2">
                            <span class="stock-name">${trade.stock_name}</span>
                            <span class="${badgeClass}">${badgeText}</span>
                        </div>
                        <span class="text-sm text-gray-400">${new Date(trade.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                    </div>
                    <div class="activity-details">
                        <div class="activity-detail">
                            <span class="activity-label">Quantity</span>
                            <span class="activity-value">${trade.quantity}</span>
                        </div>
                        <div class="activity-detail">
                            <span class="activity-label">${trade.action === 'BUY' ? 'Buy Price' : 'Sell Price'}</span>
                            <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${(trade.action === 'BUY' ? trade.price_buy : trade.price_sell || trade.currentPrice).toFixed(2)}</span>
                        </div>
                        ${isCompleted ? `
                            <div class="activity-detail">
                                <span class="activity-label">Sell Price</span>
                                <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${trade.price_sell.toFixed(2)}</span>
                            </div>
                            <div class="activity-detail">
                                <span class="activity-label">Total P/L</span>
                                <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}${trade.currency === 'USD' ? '$' : '₹'}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                            </div>
                        ` : `
                            <div class="activity-detail">
                                <span class="activity-label">Current Price</span>
                                <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${trade.currentPrice.toFixed(2)}</span>
                            </div>
                            <div class="activity-detail">
                                <span class="activity-label">Unrealized P/L</span>
                                <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}${trade.currency === 'USD' ? '$' : '₹'}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                            </div>
                        `}
                    </div>`;
            activitySection.appendChild(activityItem);
        });
    }
}

function toggleTradePanel(type) {
    const overlay = document.getElementById("tradeOverlay");
    const panel = document.getElementById("tradePanel");
    const title = document.getElementById("tradePanelTitle");
    title.textContent = type === 'holding' ? "Add Holding" : "New Trade";
    overlay.classList.toggle("open");
    panel.classList.toggle("open");
    resetTradeForm();
}

function toggleUSTradePanel(type) {
    const overlay = document.getElementById("usTradeOverlay");
    const panel = document.getElementById("usTradePanel");
    const title = document.getElementById("usTradePanelTitle");
    if (!overlay || !panel || !title) return;
    title.textContent = "Add US Stock";
    overlay.classList.toggle("open");
    panel.classList.toggle("open");
    resetUSTradeForm();
}

function closeTradePanel(event) {
    const overlay = document.getElementById("tradeOverlay");
    const panel = document.getElementById("tradePanel");
    if (!panel.contains(event.target) || event.target.tagName === 'BUTTON') {
        overlay.classList.remove("open");
        panel.classList.remove("open");
    }
}

function closeUSTradePanel(event) {
    const overlay = document.getElementById("usTradeOverlay");
    const panel = document.getElementById("usTradePanel");
    if (!panel.contains(event.target) || event.target.tagName === 'BUTTON') {
        overlay.classList.remove("open");
        panel.classList.remove("open");
    }
}

function resetTradeForm() {
    document.getElementById("tradeForm").reset();
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId);
        priceUpdateIntervalId = null;
    }
}

function resetUSTradeForm() {
    document.getElementById("usTradeForm").reset();
    if (priceUSUpdateIntervalId) {
        clearInterval(priceUSUpdateIntervalId);
        priceUSUpdateIntervalId = null;
    }
}

function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const openTime = 9 * 60 + 15;
    const closeTime = 15 * 60 + 30;
    return currentTime >= openTime && currentTime < closeTime;
}

function isUSMarketOpen() {
    const now = new Date();
    const isDST = (now.getUTCMonth() > 2 && now.getUTCMonth() < 10) ||
                  (now.getUTCMonth() === 2 && now.getUTCDate() >= 14) ||
                  (now.getUTCMonth() === 10 && now.getUTCDate() < 7);
    const estOffset = isDST ? -4 * 60 * 60 * 1000 : -5 * 60 * 60 * 1000;
    const estTime = new Date(now.getTime() + estOffset);
    const hours = estTime.getUTCHours();
    const minutes = estTime.getUTCMinutes();
    const day = estTime.getUTCDay();
    const currentTime = hours * 60 + minutes;
    const openTime = US_MARKET_OPEN.hours * 60 + US_MARKET_OPEN.minutes;
    const closeTime = US_MARKET_CLOSE.hours * 60 + US_MARKET_CLOSE.minutes;

    console.log(`US Market Check: Day=${day}, Time=${hours}:${minutes} EDT, Open=${currentTime >= openTime && currentTime < closeTime}`); // Debug
    return day >= 1 && day <= 5 && currentTime >= openTime && currentTime < closeTime;
}

function formatISTTime(date) {
    const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-IN', options);
}

function formatESTTime(date) {
    const options = { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

function handleTradeSubmit(type, isBuy) {
    if (!isMarketOpen()) {
        alert(`Market is closed! Trading is allowed only between 9:15 AM and 3:30 PM IST. Current IST: ${formatISTTime(new Date())}`);
        return;
    }

    const stockSymbolInput = document.getElementById("stockSymbol");
    const stockSymbol = stockSymbolInput.value.toUpperCase();
    const stockName = stockSymbolInput.dataset.stockName || stockSymbol;
    const quantity = document.getElementById("quantity").value;
    const priceInput = document.getElementById("price");
    const buyAtPrice = parseFloat(document.getElementById("buyAtPrice").value) || 0;
    const stopLoss = parseFloat(document.getElementById("stopLoss").value) || 0;
    const targetProfit = parseFloat(document.getElementById("targetProfit").value) || 0;

    if (!stockSymbol || !quantity) {
        alert("Please fill all required fields");
        return;
    }

    showLoader();
    fetchLatestPrice(stockSymbol).then(latestPrice => {
        if (latestPrice) {
            const effectiveBuyPrice = (isBuy && buyAtPrice > 0) ? buyAtPrice : latestPrice;
            priceInput.value = formatIndianNumber(latestPrice);

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
                currency: 'INR'
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
            if (type === 'intraday') updateIntradaySection();
            else updateHoldingSection();
            updateActivitySection();
            closeTradePanel(new Event('click'));
            hideLoader();
        } else {
            alert("Failed to fetch latest price.");
            hideLoader();
        }
    }).catch(error => {
        console.error('Error in handleTradeSubmit:', error);
        hideLoader();
    });
}

function handleUSTradeSubmit(type, isBuy) {
    if (type === 'usStocks' && !isUSMarketOpen()) {
        alert(`US market is closed! Trading is allowed only between 9:30 AM and 4:00 PM EST/EDT. Current EST: ${formatESTTime(new Date())}`);
        return;
    }

    const stockSymbolInput = document.getElementById("usStockSymbol");
    const stockName = stockSymbolInput.dataset.stockName || stockSymbolInput.value.toUpperCase();
    const quantity = document.getElementById("usQuantity")?.value;
    const priceInput = document.getElementById("usPrice");
    const buyAtPrice = parseFloat(document.getElementById("usBuyAtPrice")?.value) || 0;
    const stopLoss = parseFloat(document.getElementById("usStopLoss")?.value) || 0;
    const targetProfit = parseFloat(document.getElementById("usTargetProfit")?.value) || 0;

    if (!stockSymbolInput.value || !quantity) {
        alert("Please fill all required fields");
        return;
    }

    showLoader();
    fetchUSLatestPrice(stockSymbolInput.value).then(latestPrice => {
        if (latestPrice) {
            const effectiveBuyPrice = (isBuy && buyAtPrice > 0) ? buyAtPrice : latestPrice;
            priceInput.value = `$${latestPrice.toFixed(2)}`;

            const tradeData = {
                symbol: stockSymbolInput.value.toUpperCase(),
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
                marketType: 'usStocks',
                currency: 'USD'
            };

            const oppositeTrade = activeUSTrades.find(t => t.symbol === tradeData.symbol && t.type === type && t.action !== tradeData.action && !t.completed);
            if (oppositeTrade) {
                oppositeTrade.completed = true;
                oppositeTrade.price_sell = !isBuy ? latestPrice : oppositeTrade.price_sell;
                oppositeTrade.price_buy = isBuy ? effectiveBuyPrice : oppositeTrade.price_buy;
                tradeData.completed = true;
            } else {
                activeUSTrades.push(tradeData);
            }

            localStorage.setItem('trades', JSON.stringify(activeUSTrades));
            updateUSStocksSection();
            updateActivitySection();
            closeUSTradePanel(new Event('click'));
        } else {
            alert("Failed to fetch latest price.");
        }
        hideLoader();
    }).catch(error => {
        console.error('Error in handleUSTradeSubmit:', error);
        alert('Error processing trade. Please try again.');
        hideLoader();
    });
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
        activeTrades.forEach(trade => {
            if (trade.type === 'intraday' && !trade.completed) {
                trade.completed = true;
                trade.price_sell = trade.currentPrice;
                trade.timestamp_close = new Date().toISOString();
            }
        });
        localStorage.setItem('trades', JSON.stringify(activeTrades));
        updateIntradaySection();
        updateActivitySection();
    }
}

function deleteTrade(symbol, timestamp) {
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
        } else if (trade.action === 'SELL') {
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
                isShortSell: trade.action === 'SELL'
            };
        }

        if (trade.action === 'BUY') {
            holdingsBySymbol[trade.symbol].buyQuantity += trade.quantity;
            holdingsBySymbol[trade.symbol].totalBuyAmount += trade.quantity * trade.price_buy;
            holdingsBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            holdingsBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
        } else if (trade.action === 'SELL') {
            holdingsBySymbol[trade.symbol].sellQuantity += trade.quantity;
            holdingsBySymbol[trade.symbol].totalSellAmount += trade.quantity * trade.price_sell;
            holdingsBySymbol[trade.symbol].totalStopLoss += (trade.stopLoss || 0) * trade.quantity;
            holdingsBySymbol[trade.symbol].totalTargetProfit += (trade.targetProfit || 0) * trade.quantity;
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
              <div>₹${trade.currentPrice?.toFixed(2)}</div>
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
    if (!activitySection) return;
    activitySection.innerHTML = '';

    const usStocksTrades = activeUSTrades.filter(t => t.type === 'usStocks' && !t.completed);
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

    localStorage.setItem('trades', JSON.stringify(activeUSTrades));
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
                <span class="text-sm text-gray-400 flex-shrink-0">${new Date(trade.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }${trade.exitReason ? ' (' + trade.exitReason + ')' : ''}</span>
            </div>
            <div class="activity-details">
                <div class="activity-detail">
                    <span class="activity-label">Quantity</span>
                    <span class="activity-value">${trade.quantity}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isShortSell ? 'Sell Price' : 'Buy Price'}</span>
                    <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${(isShortSell ? trade.price_sell : trade.price_buy).toFixed(2)}</span>
                </div>
                ${isCompleted ? `
                    <div class="activity-detail">
                        <span class="activity-label">${isShortSell ? 'Exit Price (Buy)' : 'Sell Price'}</span>
                        <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${(isShortSell ? trade.price_buy : trade.price_sell).toFixed(2)}</span>
                    </div>
                ` : `
                    <div class="activity-detail">
                        <span class="activity-label">Current Price</span>
                        <span class="activity-value">${trade.currency === 'USD' ? '$' : '₹'}${trade.currentPrice.toFixed(2)}</span>
                    </div>
                `}
                <div class="activity-detail">
                    <span class="activity-label">Stop Loss</span>
                    <span class="activity-value">${trade.stopLoss > 0 ? (trade.currency === 'USD' ? '$' : '₹') + trade.stopLoss.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">Target Profit</span>
                    <span class="activity-value">${trade.targetProfit > 0 ? (trade.currency === 'USD' ? '$' : '₹') + trade.targetProfit.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isShortSell ? 'Sold At' : 'Buy At'}</span>
                    <span class="activity-value">${trade.buyAtPrice > 0 ? (trade.currency === 'USD' ? '$' : '₹') + trade.buyAtPrice.toFixed(2) : 'Market'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isCompleted ? 'Total P/L' : 'Unrealized P/L'}</span>
                    <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}${trade.currency === 'USD' ? '$' : '₹'}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">Exit Reason</span>
                    ${trade.exitReason ? trade.exitReason : "Manual Exit"}
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
    const netPLPercentage = totalInvested > 0 ? ((netPL / totalInvested) * 100).toFixed(2) : '0.00';

    updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage);
}


function updateIntradaySummary(invested, current, totalPnL) {
    const intradayTab = document.getElementById('intraday');
    if (!intradayTab) return;

    const investedElement = intradayTab.querySelector('.info-section span:nth-child(1) b:last-child');
    const currentElement = intradayTab.querySelector('.info-section span:nth-child(2) b:last-child');
    const totalPnLElement = intradayTab.querySelector('.info-section span:nth-child(3) b:last-child');

    investedElement.textContent = `₹${invested.toFixed(2)}`;
    currentElement.textContent = `₹${current.toFixed(2)}`;
    const percentage = invested > 0 ? ((totalPnL / invested) * 100).toFixed(2) : '0.00';
    totalPnLElement.textContent = `${totalPnL >= 0 ? '+' : '-'}₹${Math.abs(totalPnL).toFixed(2)} (${percentage}%)`;
    totalPnLElement.className = `mt-1 ${totalPnL >= 0 ? 'profit' : 'loss'}`;
}

function updateHoldingSummary(invested, current, totalPnL) {
    const holdingTab = document.getElementById('holding');
    if (!holdingTab) return;

    const investedElement = holdingTab.querySelector('.info-section span:nth-child(1) b:last-child');
    const currentElement = holdingTab.querySelector('.info-section span:nth-child(2) b:last-child');
    const totalPnLElement = holdingTab.querySelector('.info-section span:nth-child(3) b:last-child');

    investedElement.textContent = `₹${invested.toFixed(2)}`;
    currentElement.textContent = `₹${current.toFixed(2)}`;
    const percentage = invested > 0 ? ((totalPnL / invested) * 100).toFixed(2) : '0.00';
    totalPnLElement.textContent = `${totalPnL >= 0 ? '+' : '-'}₹${Math.abs(totalPnL).toFixed(2)} (${percentage}%)`;
    totalPnLElement.className = `mt-1 ${totalPnL >= 0 ? 'profit' : 'loss'}`;
}

function updateUSStocksSummary(invested, current, totalPnL) {
    const usStocksTab = document.getElementById('usStocks');
    if (!usStocksTab) return;

    const investedElement = usStocksTab.querySelector('.info-section span:nth-child(1) b:last-child');
    const currentElement = usStocksTab.querySelector('.info-section span:nth-child(2) b:last-child');
    const totalPnLElement = usStocksTab.querySelector('.info-section span:nth-child(3) b:last-child');

    investedElement.textContent = `$${invested.toFixed(2)}`;
    currentElement.textContent = `$${current.toFixed(2)}`;
    const percentage = invested > 0 ? ((totalPnL / invested) * 100).toFixed(2) : '0.00';
    totalPnLElement.textContent = `${totalPnL >= 0 ? '+' : '-'}$${Math.abs(totalPnL).toFixed(2)} (${percentage}%)`;
    totalPnLElement.className = `mt-1 ${totalPnL >= 0 ? 'profit' : 'loss'}`;
}

function updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage) {
    const activityTab = document.getElementById('activity');
    if (!activityTab) return;

    const totalTradesElement = activityTab.querySelector('.info-section span:nth-child(1) b:last-child');
    const completedTradesElement = activityTab.querySelector('.info-section span:nth-child(2) b:last-child');
    const netPLElement = activityTab.querySelector('.info-section span:nth-child(3) b:last-child');

    totalTradesElement.textContent = totalTrades;
    completedTradesElement.textContent = completedTrades;
    netPLElement.textContent = `${netPL >= 0 ? '+' : '-'}₹${Math.abs(netPL).toFixed(2)} (${netPLPercentage}%)`;
    netPLElement.className = `mt-1 ${netPL >= 0 ? 'profit' : 'loss'}`;
}

function exitTrade(symbol, timestamp, type) {
    const trades = type === 'usStocks' ? activeUSTrades : activeTrades;
    const trade = trades.find(t => t.symbol === symbol && t.timestamp === timestamp && t.type === type);
    if (!trade) return;

    if (type === 'usStocks' && !isUSMarketOpen()) {
        alert(`US market is closed! Cannot exit trades outside market hours. Current EST: ${formatESTTime(new Date())}`);
        return;
    }

    if (type !== 'usStocks' && !isMarketOpen()) {
        alert(`Market is closed! Cannot exit trades outside market hours. Current IST: ${formatISTTime(new Date())}`);
        return;
    }

    const confirmExit = confirm(`Are you sure you want to exit ${trade.stock_name}?`);
    if (!confirmExit) return;

    showLoader();
    const fetchPriceFunction = type === 'usStocks' ? fetchUSLatestPrice : fetchLatestPrice;
    fetchPriceFunction(symbol).then(latestPrice => {
        if (latestPrice) {
            trade.completed = true;
            trade.price_sell = trade.action === 'BUY' ? latestPrice : trade.price_sell;
            trade.price_buy = trade.action === 'SELL' ? latestPrice : trade.price_buy;
            trade.timestamp_close = new Date().toISOString();
            trade.exitReason = 'Manual Exit';

            localStorage.setItem('trades', JSON.stringify(trades));
            if (type === 'intraday') updateIntradaySection();
            else if (type === 'holding') updateHoldingSection();
            else updateUSStocksSection();
            updateActivitySection();
            alert('Trade exited successfully!');
        } else {
            alert('Failed to fetch the latest price for exit.');
        }
        hideLoader();
    }).catch(error => {
        console.error(`Error exiting trade for ${symbol}:`, error);
        alert('Failed to exit trade. Please try again.');
        hideLoader();
    });
}

function exitAllIntradayTrades() {
    if (!isMarketOpen()) {
        alert(`Market is closed! Cannot exit trades outside market hours. Current IST: ${formatISTTime(new Date())}`);
        return;
    }

    const openTrades = activeTrades.filter(t => t.type === 'intraday' && !t.completed);
    if (openTrades.length === 0) {
        alert('No open intraday trades to exit.');
        return;
    }

    const confirmExit = confirm(`Are you sure you want to exit all ${openTrades.length} intraday trades?`);
    if (!confirmExit) return;

    showLoader();
    const symbols = [...new Set(openTrades.map(t => t.symbol))];
    Promise.all(symbols.map(symbol => fetchLatestPrice(symbol)))
        .then(prices => {
            const priceMap = new Map();
            symbols.forEach((symbol, index) => priceMap.set(symbol, prices[index]));

            openTrades.forEach(trade => {
                const latestPrice = priceMap.get(trade.symbol);
                if (latestPrice) {
                    trade.completed = true;
                    trade.price_sell = trade.action === 'BUY' ? latestPrice : trade.price_sell;
                    trade.price_buy = trade.action === 'SELL' ? latestPrice : trade.price_buy;
                    trade.timestamp_close = new Date().toISOString();
                    trade.exitReason = 'Manual Exit (All)';
                }
            });

            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateActivitySection();
            alert('All intraday trades exited successfully!');
            hideLoader();
        })
        .catch(error => {
            console.error('Error exiting all intraday trades:', error);
            alert('Failed to exit some trades. Please try again.');
            hideLoader();
        });
}

function exitAllHoldings() {
    if (!isMarketOpen()) {
        alert(`Market is closed! Cannot exit holdings outside market hours. Current IST: ${formatISTTime(new Date())}`);
        return;
    }

    const openHoldings = activeTrades.filter(t => t.type === 'holding' && !t.completed);
    if (openHoldings.length === 0) {
        alert('No open holdings to exit.');
        return;
    }

    const confirmExit = confirm(`Are you sure you want to exit all ${openHoldings.length} holdings?`);
    if (!confirmExit) return;

    showLoader();
    const symbols = [...new Set(openHoldings.map(t => t.symbol))];
    Promise.all(symbols.map(symbol => fetchLatestPrice(symbol)))
        .then(prices => {
            const priceMap = new Map();
            symbols.forEach((symbol, index) => priceMap.set(symbol, prices[index]));

            openHoldings.forEach(trade => {
                const latestPrice = priceMap.get(trade.symbol);
                if (latestPrice) {
                    trade.completed = true;
                    trade.price_sell = trade.action === 'BUY' ? latestPrice : trade.price_sell;
                    trade.price_buy = trade.action === 'SELL' ? latestPrice : trade.price_buy;
                    trade.timestamp_close = new Date().toISOString();
                    trade.exitReason = 'Manual Exit (All)';
                }
            });

            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateHoldingSection();
            updateActivitySection();
            alert('All holdings exited successfully!');
            hideLoader();
        })
        .catch(error => {
            console.error('Error exiting all holdings:', error);
            alert('Failed to exit some holdings. Please try again.');
            hideLoader();
        });
}

function exitAllUSStocks() {
    if (!isUSMarketOpen()) {
        alert(`US market is closed! Cannot exit US stocks outside market hours. Current EST: ${formatESTTime(new Date())}`);
        return;
    }

    const openUSStocks = activeUSTrades.filter(t => t.type === 'usStocks' && !t.completed);
    if (openUSStocks.length === 0) {
        alert('No open US stocks to exit.');
        return;
    }

    const confirmExit = confirm(`Are you sure you want to exit all ${openUSStocks.length} US stocks?`);
    if (!confirmExit) return;

    showLoader();
    const symbols = [...new Set(openUSStocks.map(t => t.symbol))];
    Promise.all(symbols.map(symbol => fetchUSLatestPrice(symbol)))
        .then(prices => {
            const priceMap = new Map();
            symbols.forEach((symbol, index) => priceMap.set(symbol, prices[index]));

            openUSStocks.forEach(trade => {
                const latestPrice = priceMap.get(trade.symbol);
                if (latestPrice) {
                    trade.completed = true;
                    trade.price_sell = trade.action === 'BUY' ? latestPrice : trade.price_sell;
                    trade.price_buy = trade.action === 'SELL' ? latestPrice : trade.price_buy;
                    trade.timestamp_close = new Date().toISOString();
                    trade.exitReason = 'Manual Exit (All)';
                }
            });

            localStorage.setItem('trades', JSON.stringify(activeUSTrades));
            updateUSStocksSection();
            updateActivitySection();
            alert('All US stocks exited successfully!');
            hideLoader();
        })
        .catch(error => {
            console.error('Error exiting all US stocks:', error);
            alert('Failed to exit some US stocks. Please try again.');
            hideLoader();
        });
}

function editTradeLimits(symbol, type) {
    const trades = type === 'usStocks' ? activeUSTrades : activeTrades;
    const trade = trades.find(t => t.symbol === symbol && t.type === type && !t.completed);
    if (!trade) return;

    const newStopLoss = prompt(`Enter new Stop Loss for ${trade.stock_name} (current: ${trade.stopLoss > 0 ? (trade.currency === 'USD' ? '$' : '₹') + trade.stopLoss.toFixed(2) : 'Not Set'}):`, trade.stopLoss || '');
    const newTargetProfit = prompt(`Enter new Target Profit for ${trade.stock_name} (current: ${trade.targetProfit > 0 ? (trade.currency === 'USD' ? '$' : '₹') + trade.targetProfit.toFixed(2) : 'Not Set'}):`, trade.targetProfit || '');

    if (newStopLoss !== null && newStopLoss !== '') {
        const stopLossValue = parseFloat(newStopLoss);
        if (!isNaN(stopLossValue) && stopLossValue >= 0) {
            trade.stopLoss = stopLossValue;
        } else {
            alert('Invalid Stop Loss value. Please enter a valid number.');
        }
    }

    if (newTargetProfit !== null && newTargetProfit !== '') {
        const targetProfitValue = parseFloat(newTargetProfit);
        if (!isNaN(targetProfitValue) && targetProfitValue >= 0) {
            trade.targetProfit = targetProfitValue;
        } else {
            alert('Invalid Target Profit value. Please enter a valid number.');
        }
    }

    localStorage.setItem('trades', JSON.stringify(trades));
    if (type === 'intraday') updateIntradaySection();
    else if (type === 'holding') updateHoldingSection();
    else updateUSStocksSection();
    updateActivitySection();
}

async function fetchLatestPrice(symbol) {
    if (!isMarketOpen()) return 0;
    try {
        const apiUrl = `https://www.moneycontrol.com/mc/widget/stockdetail/getChartInfo?classic=true&scId=${symbol}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return parseFloat(data.lastPrice) || 0;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return 0;
    }
}

async function fetchUSLatestPrice(symbol) {
    if (!isUSMarketOpen()) {
        console.log(`Market closed, skipping price fetch for ${symbol}`);
        return 0;
    }
    try {
        const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const price = parseFloat(data.c) || 0;
        console.log(`Fetched US price for ${symbol}: $${price}`); // Debug
        return price;
    } catch (error) {
        console.error(`Error fetching US price for ${symbol}:`, error);
        return 0;
    }
}


function formatIndianNumber(num) {
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
    return formatter.format(num).replace('₹', '');
}
