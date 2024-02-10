
# install by uvicorn ASGI server
# pip install "uvicorn[standard]" fastapi gunicorn pydantic scikit-learn pandas surprise mysql-connector-python python-dotenv

# run server
# uvicorn recommender:app --port 8000 --reload

from fastapi import FastAPI
import pandas as pd
import logging
import json
import joblib
from connection.mysqlconnect import connect
import math

logger = logging.getLogger(__name__)

app = FastAPI()

def getItem():
    items = list()
    conn = connect()
    cursor = conn.cursor()
    query = f"""
    SELECT itemId FROM items
    """
    cursor.execute(query)
    result = cursor.fetchall()
    for i in result:
        items.append(i[0])
    conn.close()
    return items

def getEvent():
    itemEvents = list()
    conn = connect()
    cursor = conn.cursor()
    query = f"""
    SELECT * FROM item_events;
    """
    cursor.execute(query)
    result = cursor.fetchall()
    for event in result:
        itemEvents.append({"userId": event[0], "itemId": event[1], "itemEvent": event[2]})
    conn.close()
    return itemEvents

@app.get("/")
async def getData():
    return {"message": "Test"}

def parse_csv(df):
    res = df.to_json(orient="records")
    parsed = json.loads(res)
    return parsed

@app.get("/recommend")
async def root(user_id : int = 1, limit : int = 0):
    df = getEvent()
    # pd.read_csv("./train/demo/leafyEvent.csv")
    # print(df.head(10))
    svd = joblib.load("./train/recommendation.pkl")

    # Get recommendations for a specific user
    # user_id=1

    # Get user by interact to purchase the train dataset
    user_items= [event["itemId"] for event in df if event["userId"] == user_id and event["itemEvent"] == "paid"]
    # print(user_items)
    items = getItem()

    # print(user_items)

    # Filter out items the user has already rated
    unrated_items=[item for item in items if not item in user_items]
    # print(unrated_items)
    # Make predictions for unrated items
    user_predictions=[svd.predict(user_id,item_id) for item_id in unrated_items]
    # print(user_predictions)
    # Sort predictions by estimated rating in descending order
    sorted_predictions=sorted(user_predictions,key=lambda x:x.est,reverse=True)
    # Get top 10 item recommendations
    top_recommendations= sorted_predictions[:limit] if limit > 0 else sorted_predictions
    # Print top recommendations
    print(f"\nTop 10 item recommendations for User {user_id}:")
    recommendList = list()
    for recommendation in top_recommendations:
        # print(recommendation.iid)
        # print(items)
        recommendList.append(recommendation.iid)

    return recommendList[:limit] if limit > 0 else recommendList