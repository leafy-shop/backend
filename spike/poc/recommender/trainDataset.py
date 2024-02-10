import pandas as pd
from surprise import Dataset,Reader
from surprise.model_selection import train_test_split
from surprise import SVD
from surprise import accuracy
import joblib as jb

df = pd.read_csv("./train/demo/leafyEvent.csv")
print(df.head(10))

# Create a Surprise Reader
reader=Reader(rating_scale=(1,5))

# Load the data into Surprise Dataset
surpised_data=Dataset.load_from_df(df[['userId','itemType', 'itemRating' ]],reader)

# Split the data into training and testing sets
trainset,testset=train_test_split(surpised_data,test_size=0.2,random_state=42)

# Use the SVD algorithm
svd=SVD()
# Train the algorithm on the training set
svd.fit(trainset)

predictions=svd.test(testset)
# Evaluate the predictions using RMSE (Root Mean Squared Error)
mae=accuracy.mae(predictions)
mse=accuracy.mse(predictions)
rmse=accuracy.rmse(predictions)

jb.dump(svd, "./train/recommendation.pkl")