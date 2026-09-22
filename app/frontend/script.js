// =========================
// MOVIEMIND - SCRIPT.JS
// =========================


// =========================
// HTML ELEMENTS
// =========================

const movieSearchInput = document.getElementById("movie-search");
const recommendButton = document.getElementById("recommend-button");

const recommendationGrid =
    document.getElementById("recommendation-grid");


// =========================
// GET RECOMMENDATIONS
// =========================

async function getRecommendations(movieTitle) {

    // Show loading message
    recommendationGrid.innerHTML = `
        <p>Finding movies similar to ${movieTitle}...</p>
    `;

    try {

        const response = await fetch(
            `http://127.0.0.1:8000/recommend/${encodeURIComponent(movieTitle)}`
        );

        if (!response.ok) {
            throw new Error("Failed to get recommendations");
        }

        const data = await response.json();

        // Check if recommendations exist
        if (
            !data.recommendations ||
            data.recommendations.length === 0
        ) {
            recommendationGrid.innerHTML = `
                <p>No recommendations found.</p>
            `;

            return;
        }

        // Clear loading message
        recommendationGrid.innerHTML = "";


        // Create recommendation cards
        data.recommendations.forEach(movie => {

            const card = document.createElement("div");

            card.classList.add("recommendation-card");

            card.innerHTML = `
                <div class="recommendation-poster">
                    🎬
                </div>

                <h3>${movie.title}</h3>

                <p>
                    Similarity:
                    ${(movie.similarity_score * 100).toFixed(1)}%
                </p>
            `;

            recommendationGrid.appendChild(card);

        });

    } catch (error) {

        console.error(error);

        recommendationGrid.innerHTML = `
            <p>
                Unable to connect to MovieMind server.
                Please make sure FastAPI is running.
            </p>
        `;
    }
}


// =========================
// RECOMMENDATION BUTTON
// =========================

recommendButton.addEventListener("click", () => {

    const movieTitle = movieSearchInput.value.trim();

    if (!movieTitle) {

        alert("Please enter a movie name.");

        return;
    }

    getMovieDetails(movieTitle);    
    getRecommendations(movieTitle);

});

// =========================
// MOVIE DETAILS
// =========================

async function getMovieDetails(movieTitle) {
    try {
        const response = await fetch(
            `http://127.0.0.1:8000/movie/${encodeURIComponent(movieTitle)}`
        );

        if (!response.ok) {
            throw new Error("Movie details not found");
        }

        const movie = await response.json();

        // Update movie title
        document.getElementById("selected-movie-title").textContent =
            movie.title;

        // Update sentiment movie title
        document.getElementById("review-movie-title").textContent =
            movie.title;

        // Clear previous review when a new movie is selected
        document.getElementById("review-input").value = "";

        // Reset previous sentiment result
        document.getElementById("sentiment-label").textContent =
            "Your result will appear here.";

        document.getElementById("sentiment-confidence").textContent =
            "Model Score: --";

        document.getElementById("sentiment-result").style.display = "none";

        // Update rating
        document.getElementById("selected-movie-rating").textContent =
            `⭐ Rating: ${movie.vote_average}/10`;

        // Update votes
        document.getElementById("selected-movie-votes").textContent =
            `👥 Votes: ${movie.vote_count}`;

        document.getElementById("selected-movie-genres").textContent =
            `Genres: ${movie.genres.join(" • ")}`;

        // Update overview
        document.getElementById("selected-movie-overview").textContent =
            movie.overview;

        // Clear previous poster
        document.getElementById("selected-movie-poster")
            .removeAttribute("src");

        // Get poster separately from TMDB
        try {
            const posterResponse = await fetch(
                `http://127.0.0.1:8000/poster/${movie.id}`
            );

            if (posterResponse.ok) {
                const posterData = await posterResponse.json();

                if (posterData.poster_url) {
                    document.getElementById("selected-movie-poster").src =
                        posterData.poster_url;
                }
            }
        } catch (posterError) {
            console.error("Poster could not be loaded:", posterError);

            // Poster failed, but movie details should remain visible
            document.getElementById("selected-movie-poster")
                .removeAttribute("src");
        }

    } catch (error) {
        console.error(error);

        document.getElementById("selected-movie-title").textContent =
            "Movie not found";

        document.getElementById("selected-movie-poster")
            .removeAttribute("src");

        document.getElementById("selected-movie-rating").textContent =
            "⭐ Rating: --";

        document.getElementById("selected-movie-votes").textContent =
            "👥 Votes: --";

        document.getElementById("selected-movie-genres").textContent =
            "Genres: --";

        document.getElementById("selected-movie-overview").textContent =
            "Unable to load movie details.";
    }
}

// =========================
// SENTIMENT ANALYSIS
// =========================

const sentimentButton = document.getElementById("sentiment-button");

sentimentButton.addEventListener("click", analyzeSentiment);

async function analyzeSentiment() {

    const reviewInput = document.getElementById("review-input");
    const sentimentLabel = document.getElementById("sentiment-label");
    const sentimentConfidence = document.getElementById("sentiment-confidence");
    const sentimentResult = document.getElementById("sentiment-result");

    const review = reviewInput.value.trim();

    // Check if user entered a review
    if (!review) {
        sentimentLabel.textContent = "Please write a review first.";
        sentimentConfidence.textContent = "Model Score: --";
        return;
    }

    try {

        sentimentLabel.textContent = "Analyzing...";
        sentimentConfidence.textContent = "Model Score: --";

        sentimentResult.style.display = "block";

        const response = await fetch(
            "http://127.0.0.1:8000/sentiment?review=" +
            encodeURIComponent(review),
            {
                method: "POST"
            }
        );

        if (!response.ok) {
            throw new Error("Sentiment analysis failed");
        }

        const result = await response.json();

        // Display sentiment
        if (result.sentiment === "Positive") {
            sentimentLabel.textContent = "😊 Positive";
        } else {
            sentimentLabel.textContent = "😞 Negative";
        }

        // Display SVM decision score
        sentimentConfidence.textContent =
            `Model Score: ${result.decision_score}`;

    } catch (error) {

        console.error("Sentiment error:", error);

        sentimentLabel.textContent =
            "Unable to analyze sentiment.";

        sentimentConfidence.textContent =
            "Model Score: --";
    }
}