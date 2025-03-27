import requests
from bs4 import BeautifulSoup
from pushbullet import Pushbullet

# Pushbullet API Key (Replace it with your secure key)
API_KEY = "o.rPzjmQqA9P15fvbPlCmwcHhVQmEjwIYZ"

# CNBC TV18 Market Page URL
URL = "https://www.cnbctv18.com/market/"

def get_latest_articles():
    response = requests.get(URL)
    soup = BeautifulSoup(response.text, "html.parser")

    # Extract latest articles
    articles = soup.find_all("h3", class_="jsx-3523802742")  # Adjust class if needed

    latest_news = []
    for article in articles[:3]:  # Get only top 3 articles
        title = article.get_text(strip=True)
        link = article.find_parent("a")["href"]
        latest_news.append(f"{title}\nLink: {link}")

    return latest_news

def send_notifications(news_list):
    pb = Pushbullet(API_KEY)
    for news in news_list:
        pb.push_note("Latest Market News", news)
        print("Notification Sent:", news)

if __name__ == "__main__":
    latest_news = get_latest_articles()
    if latest_news:
        send_notifications(latest_news)
    else:
        print("No articles found!")
