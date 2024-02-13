import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.metrics import mean_squared_error, mean_absolute_error
import numpy as np
import joblib as jb

df = pd.read_csv("./train/demo/leafyEvent.csv")

userId_type_ratings=df.pivot_table(index='userId',columns="itemId",values='itemRating')

userId_type_ratings=userId_type_ratings.fillna(0)

user_similarity=cosine_similarity(userId_type_ratings)

user_similarity_df=pd.DataFrame(user_similarity,index=userId_type_ratings.index,columns=userId_type_ratings.index)

def get_item_recommendations(user_id,user_similarity_df,userId_type_ratings,n_recommendations=10):
    # Sort similar users based on cosine similarity
    similar_users=user_similarity_df.loc[user_id].sort_values(ascending=False).index[1:]
    user_ratings=userId_type_ratings.loc[user_id]
    recommendations=[]
    for other_user in similar_users:
        other_user_ratings=userId_type_ratings.loc[other_user]
        # print(other_user_ratings)
        # checking if other users rating more than 3 and focus on user rating then return other user rating
        item_rating=other_user_ratings[(other_user_ratings>3)&(user_ratings==0)] 
        # sorting movies by index
        item=item_rating.sort_values(ascending=False).index
        # print(item)
        recommendations.extend(item)
        if len(recommendations)>n_recommendations:
            break;
    return recommendations[:n_recommendations]

def calculate_mae():
    total_rmse = 0
    for user_id in userId_type_ratings.index:
        similar_users = user_similarity_df.loc[user_id].sort_values(ascending=False).index[1:]
        user_ratings = userId_type_ratings.loc[user_id]
        recommendations = predict_ratings(similar_users, user_ratings)
        # Actual ratings of recommended items
        actual_ratings = userId_type_ratings.loc[user_id, recommendations]
        # Predicted ratings set to 5 for simplicity
        predicted_ratings = pd.Series(5, index=actual_ratings.index)
        # Calculate RMSE for this user
        rmse = mean_absolute_error(actual_ratings, predicted_ratings)
        total_rmse += rmse
    # Average RMSE over all users
    avg_rmse = total_rmse / len(userId_type_ratings.index)
    return avg_rmse

# Function to predict ratings for a user
def predict_ratings(similar_users, user_ratings):
    recommendations = []
    for other_user in similar_users:
        other_user_ratings = userId_type_ratings.loc[other_user]
        # Get items rated highly by other user and not by the target user
        item_rating = other_user_ratings[(other_user_ratings > 3) & (user_ratings == 0)]
        item = item_rating.index
        recommendations.extend(item)
        if len(recommendations) > 10:
            break
    return recommendations

# RMSE calculation
def calculate_rmse():
    total_rmse = 0
    for user_id in userId_type_ratings.index:
        similar_users = user_similarity_df.loc[user_id].sort_values(ascending=False).index[1:]
        user_ratings = userId_type_ratings.loc[user_id]
        recommendations = predict_ratings(similar_users, user_ratings)
        # Actual ratings of recommended items
        actual_ratings = userId_type_ratings.loc[user_id, recommendations]
        # Predicted ratings set to 5 for simplicity
        predicted_ratings = pd.Series(5, index=actual_ratings.index)
        # Calculate RMSE for this user
        rmse = np.sqrt(mean_squared_error(actual_ratings, predicted_ratings))
        total_rmse += rmse
    # Average RMSE over all users
    avg_rmse = total_rmse / len(userId_type_ratings.index)
    return avg_rmse

def calculate_mse():
    total_rmse = 0
    for user_id in userId_type_ratings.index:
        similar_users = user_similarity_df.loc[user_id].sort_values(ascending=False).index[1:]
        user_ratings = userId_type_ratings.loc[user_id]
        recommendations = predict_ratings(similar_users, user_ratings)
        # Actual ratings of recommended items
        actual_ratings = userId_type_ratings.loc[user_id, recommendations]
        # Predicted ratings set to 5 for simplicity
        predicted_ratings = pd.Series(5, index=actual_ratings.index)
        # Calculate RMSE for this user
        rmse = mean_squared_error(actual_ratings, predicted_ratings)
        total_rmse += rmse
    # Average RMSE over all users
    avg_rmse = total_rmse / len(userId_type_ratings.index)
    return avg_rmse


# Calculate and print RMSE
avg_rmse = calculate_rmse()
avg_mse = calculate_mse()
avg_mae = calculate_mae()
print("Average RMSE:", avg_rmse)
print("Average MSE:", avg_mse)
print("Average MAE:", avg_mae)

user_id="8a7cb1700ab3c9cbc43c0b02b4bbc36a"

print(get_movie_recommendations(user_id,user_similarity_df,userId_type_ratings,10))
# jb.dump(svd, "./train/recommendation.pkl")