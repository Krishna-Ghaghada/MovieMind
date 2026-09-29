from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import pickle
import json
import os
import requests
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")
TMDB_ACCESS_TOKEN = os.getenv("TMDB_ACCESS_TOKEN")
print("TMDB token loaded:", bool(TMDB_ACCESS_TOKEN))

# =========================
# FASTAPI APP
# =========================

app = FastAPI(title="MovieMind API")


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# LOAD RECOMMENDATION DATA
# =========================

movies = pd.read_pickle(
    BASE_DIR / "model" / "movies_recommendation.pkl"
)

with open(
    BASE_DIR / "model" / "tfidf_similarity_recommend.pkl",
    "rb"
) as file:
    tfidf_similarity = pickle.load(file)

# Load TMDB movie details
movie_details = pd.read_csv(BASE_DIR / "data" / "tmdb_5000_movies.csv")

# =========================
# LOAD SENTIMENT DATA
# =========================

# Load sentiment model
with open(BASE_DIR / "model" / "svm_model.pkl", "rb") as f:
    sentiment_model = pickle.load(f)

# Load sentiment TF-IDF
with open(BASE_DIR / "model" / "tfidf_movie_review.pkl", "rb") as f:
    sentiment_tfidf = pickle.load(f)

print("Sentiment SVM model loaded successfully!")
print("Sentiment TF-IDF loaded successfully!")

# =========================
# HOME / TEST ENDPOINT
# =========================

@app.get("/")
def home():
    return FileResponse(BASE_DIR / "app" / "frontend" / "index.html")

# =========================
# RECOMMENDATION ENDPOINT
# =========================

@app.get("/recommend/{movie_title}")
def recommend(movie_title: str):

    # Check whether movie exists
    if movie_title not in movies["title"].values:
        return {
            "recommendations": []
        }

    # Find movie index
    movie_index = movies[
        movies["title"] == movie_title
    ].index[0]

    # Get similarity scores
    distances = tfidf_similarity[movie_index]

    # Sort movies by similarity
    movie_list = sorted(
        list(enumerate(distances)),
        key=lambda x: x[1],
        reverse=True
    )[1:6]

    # Create response
    recommendations = []

    for index, score in movie_list:
        recommendations.append({
            "title": movies.iloc[index]["title"],
            "similarity_score": float(score)
        })

    return {
        "movie": movie_title,
        "recommendations": recommendations
    }

# =========================
# MOVIE DETAILS ENDPOINT
# =========================

@app.get("/movie/{movie_title}")
def get_movie_details(movie_title: str):

    # Find the movie
    movie = movie_details[
        movie_details["title"].str.lower() == movie_title.lower()
    ]

    # Movie not found
    if movie.empty:
        return {
            "error": "Movie not found"
        }

    # Get the first matching movie
    movie = movie.iloc[0]

    return {
        "id": int(movie["id"]),
        "title": movie["title"],
        "overview": movie["overview"],
        "vote_average": float(movie["vote_average"]),
        "vote_count": int(movie["vote_count"]),
        "genres": [
            genre["name"] 
            for genre in json.loads(movie["genres"])
            ],       
        "release_date": movie["release_date"],
        "runtime": movie["runtime"],
        "original_language": movie["original_language"],
        "tagline": movie["tagline"]
    }

@app.get("/poster/{movie_id}")
def get_movie_poster(movie_id: int):

    url = f"https://api.themoviedb.org/3/movie/{movie_id}"

    headers = {
        "Authorization": f"Bearer {TMDB_ACCESS_TOKEN}",
        "accept": "application/json"
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=5
        )

        if response.status_code != 200:
            return {"poster_url": None}

    except requests.RequestException as e:
        print("TMDB poster request failed:", e)
        return {"poster_url": None}    

    tmdb_movie = response.json()

    poster_path = tmdb_movie.get("poster_path")

    if not poster_path:
        return {"poster_url": None}

    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"

    return {
        "poster_url": poster_url
    }

@app.post("/sentiment")
def analyze_sentiment(review: str):

    review_tfidf = sentiment_tfidf.transform([review])

    prediction = sentiment_model.predict(review_tfidf)[0]

    decision_score = sentiment_model.decision_function(review_tfidf)[0]

    if prediction == 1:
        sentiment = "Positive"
    else:
        sentiment = "Negative"

    return {
        "sentiment": sentiment,
        "decision_score": round(float(decision_score), 4)
    }
app.mount(
    "/",
    StaticFiles(directory=BASE_DIR / "app" / "frontend"),
    name="frontend"
)