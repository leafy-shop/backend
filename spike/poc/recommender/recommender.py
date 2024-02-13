
# install by uvicorn ASGI server
# pip install "uvicorn[standard]" fastapi gunicorn pydantic scikit-learn pandas surprise mysql-connector-python python-dotenv

# run server
# uvicorn recommender:app --port 8000 --reload

from fastapi import FastAPI
import pandas as pd
import logging
import json
from connection.mysqlconnect import connect
from sklearn.metrics.pairwise import cosine_similarity
from collaborativeFiltering import get_item_recommendations

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
    SELECT ie.userId, ie.itemId, i.totalRating, ie.itemEvent FROM item_events ie JOIN items i on i.itemId = ie.itemId;
    """
    cursor.execute(query)
    result = cursor.fetchall()
    for event in result:
        itemEvents.append({"userId": event[0], "itemId": event[1], "totalRating": event[2], "itemEvent": event[3]})
    conn.close()
    return itemEvents

@app.get("/")
async def getData():
    return {"message": "Test"}

def parse_csv(df):
    res = df.to_json(orient="records")
    parsed = json.loads(res)
    return parsed

@app.get("/ml/recommend")
async def root(user_id : int = 1, limit : int = 10):
    limitN = 1 if limit <= 0 else limit
    json_event = getEvent()

    # Convert dictionary to a DataFrame
    df = pd.DataFrame(json_event)
    print(df)

    userId_type_ratings=df.pivot_table(index='userId',columns="itemId",values='totalRating')

    userId_type_ratings=userId_type_ratings.fillna(0)

    user_similarity=cosine_similarity(userId_type_ratings)

    user_similarity_df=pd.DataFrame(user_similarity,index=userId_type_ratings.index,columns=userId_type_ratings.index)

    return get_item_recommendations(user_id,user_similarity_df, userId_type_ratings)

