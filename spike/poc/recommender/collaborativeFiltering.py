def get_item_recommendations(user_id,user_similarity_df,userId_type_ratings,n_recommendations=10):
    # Sort similar users based on cosine similarity
    similar_users=user_similarity_df.loc[user_id].sort_values(ascending=False).index[1:]
    user_ratings=userId_type_ratings.loc[user_id]
    print(user_ratings)
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