
let isSignedIn = localStorage.getItem('isSignedIn') === 'true';


function toggleSignInOverlay() {
    document.getElementById('signInOverlay').style.display = 'flex';
}

function handleSignIn() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simple hardcoded credentials (for demo; no database)
    if (username.length >= 5 && password.length >= 6) {
        isSignedIn = true;
        localStorage.setItem(`userid`, username);
        localStorage.setItem("isSignedIn",true)
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
    // Rest of your existing DOMContentLoaded logic here
});

// Include the rest of your JavaScript (e.g., fetchLatestPrice, updateIntradaySection, etc.) here
let typingTimer;
const doneTypingInterval = 300;
const priceUpdateInterval = 1000;
let livePrices = new Map();
let activeTrades = [];

const INTRADAY_OPEN = { hours: 9, minutes: 15 };
const INTRADAY_CLOSE = { hours: 15, minutes: 15 };
const HOLDING_CLOSE = { hours: 15, minutes: 30 };

function callapi(e) {
    clearTimeout(typingTimer);
    const searchValue = e.target.value.trim();
    if (!searchValue) {
        document.getElementById('searchResultsContainer').classList.add('hidden');
        return;
    }
    typingTimer = setTimeout(() => fetchStockSymbols(searchValue), doneTypingInterval);
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

async function selectStock(symbol, name) {
    const symbolInput = document.getElementById('stockSymbol');
    const priceInput = document.getElementById('price');
    symbolInput.value = symbol;
    document.getElementById('searchResultsContainer').classList.add('hidden');

    try {
        showLoader();
        const price = await fetchLatestPrice(symbol); // Fetch real-time price
        if (price > 0) {
            priceInput.value = formatIndianNumber(price); // Use Indian formatting
            livePrices.set(symbol, price); // Update the live prices map
            startPriceUpdateForInput(symbol, priceInput)

        } else {
            priceInput.value = 'N/A';
        }
        // Store the stock name in a data attribute for later use
        symbolInput.dataset.stockName = name;
        hideLoader();
    } catch (error) {
        console.error('Error in selectStock:', error);
        priceInput.value = 'N/A';
        hideLoader();
    }
}

function startPriceUpdateForInput(symbol, priceInput) {
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId); // Clear any existing interval
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
    }, 1000); // Update every 1 second
}

// New function to update price input in real-time
let priceUpdateIntervalId = null;
function startPriceUpdates() {
    setInterval(async () => {
        if (!isMarketOpen()) return;

        let pricesUpdated = false;
        const uniqueSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];

        for (const symbol of uniqueSymbols) {
            try {
                const price = await fetchLatestPrice(symbol);
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
                                } else if (trade.action === 'SELL') { // Short sell logic
                                    if (trade.stopLoss > 0 && price >= trade.stopLoss) { // SL is higher
                                        trade.completed = true;
                                        trade.price_buy = price; // Buy back to exit
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Stop Loss Hit (Short)';
                                        console.log(`${trade.stock_name} SL hit (short) at ₹${price}`);
                                    } else if (trade.targetProfit > 0 && price <= trade.targetProfit) { // TP is lower
                                        trade.completed = true;
                                        trade.price_buy = price; // Buy back to exit
                                        trade.timestamp_close = new Date().toISOString();
                                        trade.exitReason = 'Target Profit Hit (Short)';
                                        console.log(`${trade.stock_name} TP hit (short) at ₹${price}`);
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
            updateActivitySection();
            localStorage.setItem('trades', JSON.stringify(activeTrades));
        }

        checkIntradayAutoClose();
    }, priceUpdateInterval);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#stockSymbol') && !e.target.closest('#searchResultsContainer')) {
        document.getElementById('searchResultsContainer').classList.add('hidden');
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
        activitySection.innerHTML = ""; // Clear results
        return;
    }



    const filteredTrades = activeTrades.filter(trade => {
        // Calculate PnL for the trade
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
    })


    activitySection.innerHTML = ""; // Clear previous results

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
                            <span class="activity-value">₹${(trade.action === 'BUY' ? trade.price_buy : trade.price_sell || trade.currentPrice).toFixed(2)}</span>
                        </div>
                        ${isCompleted ? `
                            <div class="activity-detail">
                                <span class="activity-label">Sell Price</span>
                                <span class="activity-value">₹${trade.price_sell.toFixed(2)}</span>
                            </div>
                            <div class="activity-detail">
                                <span class="activity-label">Total P/L</span>
                                <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
                            </div>
                        ` : `
                            <div class="activity-detail">
                                <span class="activity-label">Current Price</span>
                                <span class="activity-value">₹${trade.currentPrice.toFixed(2)}</span>
                            </div>
                            <div class="activity-detail">
                                <span class="activity-label">Unrealized P/L</span>
                                <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
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

function closeTradePanel(event) {
    const overlay = document.getElementById("tradeOverlay");
    const panel = document.getElementById("tradePanel");
    if (!panel.contains(event.target) || event.target.tagName === 'BUTTON') {
        overlay.classList.remove("open");
        panel.classList.remove("open");
    }
}

function resetTradeForm() {
    document.getElementById("tradeForm").reset();
    if (priceUpdateIntervalId) {
        clearInterval(priceUpdateIntervalId); // Stop price updates when form resets
        priceUpdateIntervalId = null;
    }
}
// Modify isMarketOpen to be stricter
function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const openTime = 9 * 60 + 15;  // 9:15 AM
    const closeTime = 15 * 60 + 30; // 3:30 PM
    return currentTime >= openTime && currentTime < closeTime;
}

// Add exit trade function
function exitTrade(symbol, timestamp, type) {
    if (!isMarketOpen()) {
        alert('Market is closed! Can only exit trades between 9:15 AM and 3:30 PM IST');
        return;
    }

    if (confirm('Are you sure you want to exit this trade?')) {
        const trade = activeTrades.find(t => t.symbol === symbol && t.timestamp === timestamp);
        if (trade && !trade.completed) {
            trade.completed = true;
            trade.price_sell = trade.currentPrice;
            trade.timestamp_close = new Date().toISOString();
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateHoldingSection();
            updateActivitySection();
            alert('Trade exited successfully!');
        }
    }
}

function formatISTTime(date) {
    const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-IN', options);
}


// Fix handleTradeSubmit
function handleTradeSubmit(type, isBuy) {
    // if (!isMarketOpen()) {
    //     alert(`Market is closed! Trading is allowed only between 9:15 AM and 3:30 PM IST. Current IST: ${formatISTTime(new Date())}`);
    //     return;
    // }

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
                buyAtPrice: isBuy ? buyAtPrice : 0
            };

            activeTrades.push(tradeData);
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            console.log('Trade added:', tradeData);
            console.log('Updated activeTrades:', activeTrades);

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

// Fix closeTradePanel
function closeTradePanel(event) {
    const overlay = document.getElementById("tradeOverlay");
    const panel = document.getElementById("tradePanel");
    if (!panel.contains(event.target) || event.target.tagName === 'BUTTON') {
        overlay.classList.remove("open");
        panel.classList.remove("open");
    }
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

// Add delete functionality for trades
function deleteTrade(symbol, timestamp) {
    if (confirm('Are you sure you want to delete this trade?')) {
        const index = activeTrades.findIndex(t => t.symbol === symbol && t.timestamp === timestamp);
        if (index !== -1) {
            activeTrades.splice(index, 1);
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateHoldingSection();
            updateActivitySection();
            alert('Trade deleted successfully!');
        }
    }
}

// Updated updateIntradaySection function
function updateIntradaySection() {
    const activitySection = document.getElementById('intradayActivity');
    activitySection.innerHTML = '';

    const intradayTrades = activeTrades.filter(t => t.type === 'intraday' && !t.completed);
    if (intradayTrades.length === 0) {
        activitySection.innerHTML = '<div class="text-gray-400 p-4">No open intraday trades.</div>';
        updateIntradaySummary(0, 0, 0);
        return;
    }

    // Add "Exit All Trades" button
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
            tradesBySymbol[trade.symbol].action = 'SELL'; // Ensure we track this is a short sell
        }
        tradesBySymbol[trade.symbol].tradeCount += 1;
        tradesBySymbol[trade.symbol].currentPrice = trade.currentPrice;
    });

    Object.values(tradesBySymbol).forEach(trade => {
        const netQuantity = trade.buyQuantity - trade.sellQuantity;
        const isShortSell = trade.sellQuantity > trade.buyQuantity || (trade.sellQuantity > 0 && trade.buyQuantity === 0);
        const longQuantity = Math.max(0, netQuantity); // Quantity for long positions
        const shortQuantity = Math.max(0, trade.sellQuantity - trade.buyQuantity); // Quantity for short positions

        // Calculate invested amounts
        const longInvested = trade.totalBuyAmount;
        const shortInvested = trade.totalSellAmount;
        const invested = isShortSell ? shortInvested : longInvested;

        // Average prices
        const avgBuyPrice = longQuantity > 0 ? longInvested / longQuantity : 0;
        const avgSellPrice = shortQuantity > 0 ? shortInvested / shortQuantity : 0;
        const avgPrice = isShortSell ? avgSellPrice : avgBuyPrice;
        const avgStopLoss = trade.totalStopLoss / (isShortSell ? shortQuantity : longQuantity) || 0;
        const avgTargetProfit = trade.totalTargetProfit / (isShortSell ? shortQuantity : longQuantity) || 0;

        // Current value and P&L calculations
        let pnl = 0;
        let currentValue = 0;

        if (isShortSell) {
            currentValue = shortQuantity * trade.currentPrice;
            pnl = shortInvested - currentValue; // Positive when current price < avg sell price
        } else {
            currentValue = longQuantity * trade.currentPrice;
            pnl = currentValue - longInvested; // Positive when current price > avg buy price
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

    console.log(`Total Invested: ${totalInvested}, Total Current: ${totalCurrent}, Total P&L: ${totalPnL}`);
    localStorage.setItem('trades', JSON.stringify(activeTrades));
    updateIntradaySummary(totalInvested, totalCurrent, totalPnL);
}


// Updated updateActivitySection function
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
                    <span class="activity-value">₹${(isShortSell ? trade.price_sell : trade.price_buy).toFixed(2)}</span>
                </div>
                ${isCompleted ? `
                    <div class="activity-detail">
                        <span class="activity-label">${isShortSell ? 'Exit Price (Buy)' : 'Sell Price'}</span>
                        <span class="activity-value">₹${(isShortSell ? trade.price_buy : trade.price_sell).toFixed(2)}</span>
                    </div>
                ` : `
                    <div class="activity-detail">
                        <span class="activity-label">Current Price</span>
                        <span class="activity-value">₹${trade.currentPrice.toFixed(2)}</span>
                    </div>
                `}
                <div class="activity-detail">
                    <span class="activity-label">Stop Loss</span>
                    <span class="activity-value">${trade.stopLoss > 0 ? '₹' + trade.stopLoss.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">Target Profit</span>
                    <span class="activity-value">${trade.targetProfit > 0 ? '₹' + trade.targetProfit.toFixed(2) : 'Not Set'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isShortSell ? 'Sold At' : 'Buy At'}</span>
                    <span class="activity-value">${trade.buyAtPrice > 0 ? '₹' + trade.buyAtPrice.toFixed(2) : 'Market'}</span>
                </div>
                <div class="activity-detail">
                    <span class="activity-label">${isCompleted ? 'Total P/L' : 'Unrealized P/L'}</span>
                    <span class="activity-value ${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)</span>
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
    const netPLPercentage = totalInvested > 0 ? ((netPL / totalInvested) * 100).toFixed(2) : 0;

    updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage);
}

function updateIntradaySummary(invested, current, pnl) {
    const investedEl = document.querySelector('#intraday .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#intraday .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#intraday .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace(/[^\d.-]/g, '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace(/[^\d.-]/g, '')) || 0;
    const prevPnl = parseFloat(pnlEl.textContent.match(/₹([\d.]+)/)?.[1]) || 0;

    // Animate invested and current values
    if (prevInvested !== invested) animateValue(investedEl, prevInvested, invested);
    if (prevCurrent !== current) animateValue(currentEl, prevCurrent, current);

    // Calculate P&L percentage based on the difference between current and invested
    const netChange = current - invested; // Correct net change for mixed positions
    const pnlPercentage = invested > 0 ? ((netChange / invested) * 100).toFixed(2) : (current > 0 ? ((netChange / current) * 100).toFixed(2) : 0);
    const newPnlText = `${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;

    // Animate and update P&L
    if (Math.abs(prevPnl) !== Math.abs(pnl)) {
        animateValue(pnlEl, Math.abs(prevPnl), Math.abs(pnl), '');
        setTimeout(() => {
            pnlEl.textContent = newPnlText;
            pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
        }, 100); // Reduced delay for smoother update
    }
}

function updateHoldingSummary(invested, current, pnl) {
    const investedEl = document.querySelector('#holding .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#holding .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#holding .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace(/[^\d.-]/g, '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace(/[^\d.-]/g, '')) || 0;
    const prevPnl = parseFloat(pnlEl.textContent.match(/₹([\d.]+)/)?.[1]) || 0;

    if (prevInvested !== invested) animateValue(investedEl, prevInvested, invested);
    if (prevCurrent !== current) animateValue(currentEl, prevCurrent, current);

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    const newPnlText = `${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;

    if (Math.abs(prevPnl) !== Math.abs(pnl)) {
        animateValue(pnlEl, Math.abs(prevPnl), Math.abs(pnl), '');
        setTimeout(() => {
            pnlEl.textContent = newPnlText;
            pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
        }, 100);
    }
}


function updateActivitySummary(totalTrades, completedTrades, netPL, netPLPercentage) {
    document.querySelector('#activity .info-section span:nth-child(1) b:last-child').textContent = totalTrades;
    document.querySelector('#activity .info-section span:nth-child(2) b:last-child').textContent = completedTrades;
    const pnlElement = document.querySelector('#activity .info-section span:nth-child(3) b:last-child');
    pnlElement.textContent = `₹${Math.abs(netPL).toFixed(2)} (${netPLPercentage}%)`;
    pnlElement.className = netPL >= 0 ? 'profit mt-1' : 'loss mt-1';
}


// Improve the price fetching function to be more reliable
async function fetchLatestPrice(symbol) {
    try {
        const response = await fetch(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${symbol}`);
        const data = await response.json();
        const latestPrice = parseFloat(data.data?.pricecurrent);
        if (latestPrice) {
            livePrices.set(symbol, latestPrice);
            return latestPrice;
        }
        throw new Error('Price not found');
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return livePrices.get(symbol) || 0;
    }
}

function startPriceUpdates() {
    setInterval(async () => {
        if (!isMarketOpen()) return;

        let pricesUpdated = false;
        const uniqueSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];

        for (const symbol of uniqueSymbols) {
            try {
                const price = await fetchLatestPrice(symbol);
                if (price > 0) {
                    activeTrades.forEach(trade => {
                        if (trade.symbol === symbol) {
                            trade.currentPrice = price;
                            pricesUpdated = true;

                            // Check SL and TP here to ensure it runs
                            if (isMarketOpen() && !trade.completed) {
                                if (trade.stopLoss > 0 && price <= trade.stopLoss) {
                                    trade.completed = true;
                                    trade.price_sell = price;
                                    trade.timestamp_close = new Date().toISOString();
                                    trade.exitReason = 'Stop Loss Hit';
                                } else if (trade.targetProfit > 0 && price >= trade.targetProfit) {
                                    trade.completed = true;
                                    trade.price_sell = price;
                                    trade.timestamp_close = new Date().toISOString();
                                    trade.exitReason = 'Target Profit Hit';
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
            updateActivitySection();
            localStorage.setItem('trades', JSON.stringify(activeTrades)); // Save changes
        }

        checkIntradayAutoClose();
    }, priceUpdateInterval);
}

function editTradeLimits(symbol, type = 'holding') {
    const tradesToEdit = activeTrades.filter(t => t.type === type && t.symbol === symbol && !t.completed);
    if (tradesToEdit.length === 0) {
        alert(`No active ${type} trades found for this stock.`);
        return;
    }

    const newStopLoss = prompt(`Enter new Stop Loss for ${symbol} (Current: ${tradesToEdit[0].stopLoss || 'Not Set'})`, tradesToEdit[0].stopLoss || '');
    const newTargetProfit = prompt(`Enter new Target Profit for ${symbol} (Current: ${tradesToEdit[0].targetProfit || 'Not Set'})`, tradesToEdit[0].targetProfit || '');

    if (newStopLoss !== null && newTargetProfit !== null) {
        const stopLossValue = parseFloat(newStopLoss) || 0;
        const targetProfitValue = parseFloat(newTargetProfit) || 0;

        tradesToEdit.forEach(trade => {
            trade.stopLoss = stopLossValue;
            trade.targetProfit = targetProfitValue;
        });

        localStorage.setItem('trades', JSON.stringify(activeTrades));
        if (type === 'intraday') updateIntradaySection();
        else updateHoldingSection();
        updateActivitySection();
        alert(`Updated SL and TP for ${symbol} (${type})`);
    }
}

// Fixed exitAllIntradayTrades function to work with the corrected exitTrade
function exitAllIntradayTrades() {
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
        // If it's a short sell, we need to set price_buy instead of price_sell for exit
        if (trade.action === 'SELL') {
            trade.price_buy = trade.currentPrice;
        } else {
            trade.price_sell = trade.currentPrice;
        }
        trade.timestamp_close = new Date().toISOString();
    });

    localStorage.setItem('trades', JSON.stringify(activeTrades));
    alert(`${intradayTrades.length} intraday trades exited successfully!`);

    updateIntradaySection();
    updateHoldingSection();
    updateActivitySection();
}


// Helper function to format numbers in Indian style with abbreviations
function formatIndianNumber(num, isPnl = false) {
    if (isPnl && num === 0) return '₹0.00'; // Handle zero P/L case

    const absNum = Math.abs(num);
    let prefix = isPnl ? (num >= 0 ? '+₹' : '-₹') : '₹';

    if (absNum >= 10000000) { // Crore
        const croreValue = (absNum / 10000000).toFixed(2);
        return `${prefix}${croreValue} Cr`;
    } else if (absNum >= 100000) { // Lakh
        const lakhValue = (absNum / 100000).toFixed(2);
        return `${prefix}${lakhValue} L`;
    } else { // Less than 1 Lakh
        const formattedNum = absNum.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
        return `${prefix}${formattedNum}`;
    }
}

// Add this helper function for smooth number transitions
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = start + (end - start) * progress;
        element.textContent = `₹${value.toFixed(2)}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    element.classList.add('number-animate');
    window.requestAnimationFrame(step);
    setTimeout(() => element.classList.remove('number-animate'), duration);
}

// Modify isMarketOpen to be stricter
function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentTime = hours * 60 + minutes;
    const openTime = 9 * 60 + 15;  // 9:15 AM
    const closeTime = 15 * 60 + 30; // 3:30 PM
    return currentTime >= openTime && currentTime < closeTime;
}

function exitAllHoldings() {
    // Get all active holding trades
    const holdingTrades = activeTrades.filter(t => t.type === 'holding' && !t.completed);

    // Create a unique set of symbols to exit (to handle multiple trades of same symbol)
    const symbolsToExit = new Set();
    holdingTrades.forEach(trade => {
        symbolsToExit.add(trade.symbol);
    });

    // Exit each symbol
    symbolsToExit.forEach(symbol => {
        const tradesForSymbol = holdingTrades.filter(t => t.symbol === symbol);
        if (tradesForSymbol.length > 0) {
            // Use the timestamp from the first trade for this symbol
            exitTrade(symbol, tradesForSymbol[0].timestamp, 'holding');
        }
    });

    // After exiting all, update the holding section
    updateHoldingSection();
    updateActivitySection()
}

function exitTrade(symbol, timestamp, type) {
    if (!isMarketOpen()) {
        alert('Market is closed! Can only exit trades between 9:15 AM and 3:30 PM IST');
        return;
    }

    if (confirm('Are you sure you want to exit this trade?')) {
        let tradesExited = 0;

        // If timestamp is provided, exit specific trade
        if (timestamp) {
            const trade = activeTrades.find(t =>
                t.symbol === symbol &&
                t.timestamp === timestamp &&
                !t.completed
            );

            if (trade) {
                trade.completed = true;
                if (trade.action === 'SELL') {
                    trade.price_buy = trade.currentPrice;
                } else {
                    trade.price_sell = trade.currentPrice;
                }
                trade.timestamp_close = new Date().toISOString();
                tradesExited = 1;
            }
        }
        // If timestamp is not provided, exit all trades for this symbol and type
        else {
            const trades = activeTrades.filter(t =>
                t.symbol === symbol &&
                (type ? t.type === type : true) &&
                !t.completed
            );

            trades.forEach(trade => {
                trade.completed = true;
                if (trade.action === 'SELL') {
                    trade.price_buy = trade.currentPrice;
                } else {
                    trade.price_sell = trade.currentPrice;
                }
                trade.timestamp_close = new Date().toISOString();
            });

            tradesExited = trades.length;
        }

        if (tradesExited > 0) {
            localStorage.setItem('trades', JSON.stringify(activeTrades));
            updateIntradaySection();
            updateHoldingSection();
            updateActivitySection();
            alert(`${tradesExited} trade${tradesExited > 1 ? 's' : ''} exited successfully!`);
        } else {
            alert('No trades found to exit.');
        }
    }
}

// Modify startPriceUpdates to only run during market hours
function startPriceUpdates() {
    setInterval(async () => {
        if (!isMarketOpen()) return; // Skip if market is closed

        let pricesUpdated = false;
        const uniqueSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];

        for (const symbol of uniqueSymbols) {
            try {
                const price = await fetchLatestPrice(symbol);
                if (price > 0) {
                    activeTrades.forEach(trade => {
                        if (trade.symbol === symbol) {
                            trade.currentPrice = price;
                            pricesUpdated = true;
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
            updateActivitySection();
        }

        checkIntradayAutoClose();
    }, priceUpdateInterval);
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
        const longQuantity = Math.max(0, netQuantity); // Quantity for long positions
        const shortQuantity = Math.max(0, trade.sellQuantity - trade.buyQuantity); // Quantity for short positions

        // Calculate invested amounts
        const longInvested = trade.totalBuyAmount;
        const shortInvested = trade.totalSellAmount;
        const invested = isShortSell ? shortInvested : longInvested;

        // Average prices
        const avgBuyPrice = longQuantity > 0 ? longInvested / longQuantity : 0;
        const avgSellPrice = shortQuantity > 0 ? shortInvested / shortQuantity : 0;
        const avgPrice = isShortSell ? avgSellPrice : avgBuyPrice;
        const avgStopLoss = trade.totalStopLoss / (isShortSell ? shortQuantity : longQuantity) || 0;
        const avgTargetProfit = trade.totalTargetProfit / (isShortSell ? shortQuantity : longQuantity) || 0;

        // FIXED: Current value and P&L calculations
        let pnl = 0;
        let currentValue = 0;

        if (isShortSell) {
            // For short positions:
            // 1. The invested amount is what you received when selling (shortInvested)
            // 2. Current value is what you would pay to buy back the shares (shortQuantity * currentPrice)
            // 3. P&L is positive when current price is lower than sell price (you sold high, buy back low)
            currentValue = shortQuantity * trade.currentPrice;
            pnl = shortInvested - currentValue; // Positive when current price < avg sell price
        } else {
            // For long positions:
            // 1. The invested amount is what you paid to buy (longInvested)
            // 2. Current value is what you would receive if selling now (longQuantity * currentPrice)
            // 3. P&L is positive when current price is higher than buy price
            currentValue = longQuantity * trade.currentPrice;
            pnl = currentValue - longInvested; // Positive when current price > avg buy price
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

// Modify update summary functions with animation
function updateIntradaySummary(invested, current, pnl) {
    const investedEl = document.querySelector('#intraday .info-section span:nth-child(1) b:last-child');
    const currentEl = document.querySelector('#intraday .info-section span:nth-child(2) b:last-child');
    const pnlEl = document.querySelector('#intraday .info-section span:nth-child(3) b:last-child');

    const prevInvested = parseFloat(investedEl.textContent.replace('₹', '')) || 0;
    const prevCurrent = parseFloat(currentEl.textContent.replace('₹', '')) || 0;

    animateValue(investedEl, prevInvested, invested, 300);
    animateValue(currentEl, prevCurrent, current, 300);

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    pnlEl.textContent = `${pnl >= 0 ? '+' : '-'}₹${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;
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

    animateValue(investedEl, prevInvested, invested, 300);
    animateValue(currentEl, prevCurrent, current, 300);

    const pnlPercentage = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
    const sign = pnl >= 0 ? '+' : '-';
    pnlEl.textContent = `₹${sign}${Math.abs(pnl).toFixed(2)} (${pnlPercentage}%)`;
    pnlEl.className = pnl >= 0 ? 'profit mt-1' : 'loss mt-1';
    pnlEl.classList.add('number-animate');
    setTimeout(() => pnlEl.classList.remove('number-animate'), 300);
}

// Modify fetchLatestPrice to check market hours
async function fetchLatestPrice(symbol) {
    if (!isMarketOpen()) {
        return livePrices.get(symbol) || 0; // Return last known price outside market hours
    }

    try {
        const response = await fetch(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${symbol}`);
        const data = await response.json();
        const latestPrice = parseFloat(data.data?.pricecurrent);
        if (latestPrice) {
            livePrices.set(symbol, latestPrice);
            return latestPrice;
        }
        throw new Error('Price not found');
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return livePrices.get(symbol) || 0;
    }
}


