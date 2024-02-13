require("dotenv").config();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("./userModel");
const Weather = require("./weatherModel");
const NASA_API_KEY = "FYUgxA9FfcQbu2CxnHsUuNhfstLZjE24m9Dzykew";
const NEWS_API_KEY = "27df3cb829584967b560725662dc7f47";




const app = express();
const PORT = process.env.PORT || 3000;

mongoose
  .connect("mongodb+srv://Alibek:Alibek2003@cluster0.q2xkngv.mongodb.net/?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connection established"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", {
    weather: null,
    error: null,
    user: req.session.username || null,
    isAdmin: req.session.isAdmin || false, 
  });
});


  app.post("/", async (req, res) => {
    if (!req.session.userId) {
      return res.redirect(
        "/login?message=Please log in or sign up to view weather history"
      );
    }
  
    const city = req.body.city;
    const apiKey = "c0f12b43b099b4f96645664b0ac056e3";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
    const apigKey = "a60852d5f02549ef94244d433e8c080f";
    const sunUrl = `https://api.weatherbit.io/v2.0/current?city=${city}&key=${apigKey}&include=minutely`;
    try {
      const response = await axios.get(url);
      const weatherData = response.data;
      const weatherDescription = weatherData.weather[0].description;
      const iconCode = weatherData.weather[0].icon;
      const iconUrl = `http://openweathermap.org/img/w/${iconCode}.png`;
     

      const respons = await axios.get(sunUrl);
      const weatherDat = respons.data.data[0];

      const newWeather = new Weather({
        city: city,
        temperature: weatherData.main.temp,
        description:weatherDescription,
        icon: iconUrl,
        userId: req.session.userId,
        sunrise: weatherDat.sunrise,
        sunset: weatherDat.sunset,
        lon:weatherData.coord.lon,
        lat:weatherData.coord.lat,
      });
  
      await newWeather.save();
  
      res.render("index", {
        weather: newWeather,
        error: null,
        user: req.session.username,
        isAdmin: req.session.isAdmin
      });
    } catch (error) {
      console.error("Error fetching weather data:", error);
      res.render("index", {
        weather: null,
        error: "Failed to fetch data. Please try again.",
        user: req.session.username,
        isAdmin: req.session.isAdmin
      });
    }
  });


app.get("/login", (req, res) => {
  res.render("login", {
    query: req.query,
    error: null,
    user: req.session ? req.session.user : null,
    isAdmin: req.session.isAdmin
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  
  const user = await User.findOne({ username });

  if (user && password === user.password) {
    req.session.userId = user._id;
    req.session.username = user.username;

    
    req.session.isAdmin = user.isAdmin || false;

    if (req.session.isAdmin) {
      return res.redirect("/admin");
    } else {
      return res.redirect("/");
    }
  } else {
    res.render('login', {
      query: req.query, 
      error: "Invalid username or password",
      user: req.session.user || null, 
      isAdmin: req.session.isAdmin
    });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/weather-history", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const weatherHistory = await Weather.find({ userId: req.session.userId }).sort('-date');;
    res.render("weather-history", {
      weatherData: weatherHistory,
      user: req.session.username || null,
      error: null,
      isAdmin: req.session.isAdmin
    });
  } catch (error) {
    console.error("Error fetching weather history:", error);
    res.render("weather-history", {
      weatherData: [],
      user: req.session.username || null,
      error: "Error fetching weather history",
      isAdmin: req.session.isAdmin
    });
  }
});

app.get("/admin", isAdmin, async (req, res) => {
  try {
    const users = await User.find({ deletionDate: null });
    res.render("admin", {
      users: users,
      user: req.session.username, 
      isAdmin: req.session.isAdmin 
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Error loading admin page");
  }
});


function isAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).send("Access Denied");
  }
}

app.get("/admin/add-user", isAdmin, (req, res) => {
  res.render("add-user", {
    user: req.session.username, 
    isAdmin: req.session.isAdmin 
  });
});


app.post("/admin/add-user", isAdmin, async (req, res) => {
  const { username, password, isAdmin } = req.body;

  try {
    const newUser = new User({
      username,
      password: password,
      isAdmin: isAdmin === "on",
    });

    await newUser.save();

    res.redirect("/admin");
  } catch (error) {
    console.error("Error adding new user:", error);
    res.status(500).send("Failed to add new user");
  }
});

app.post("/delete-user", isAdmin, async (req, res) => {
  try {
    const userId = req.body.userId;
    await User.findByIdAndUpdate(userId, { deletionDate: new Date() });
    res.redirect("/admin");
  } catch (error) {
    console.error("Error marking user as deleted:", error);
    res.status(500).send("Error deleting user");
  }
});


app.get("/edit-user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
       
        return res.status(404).send("User not found");
    }
    res.render("edit-user", { user,isAdmin: req.session.isAdmin });
} catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Internal Server Error");
}
});


app.post("/users/edit/:userId", async (req, res) => {
  const { username, password } = req.body;
   
    let isAdmin = !!req.body.isAdmin; 

    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).send("User not found");
        }

        user.username = username;
        if (password) user.password = password;
        user.isAdmin = isAdmin;

        await user.save();
        res.redirect("/admin");
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send("Server error");
  }
});


app.get("/signup", (req, res) => {
  res.render("sign-up", {
    query: req.query,
    error: null,
    user: null,
    isAdmin: req.session.isAdmin
  });
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    res.redirect("/login");
  } catch (error) {
    res.status(500).send("Error registering new user, please try again.");
    res.render("sign-up", { error: "An error message", query: req.query, isAdmin: req.session.isAdmin });
  }
});



app.get('/news', async (req, res) => {

  const user = req.session.userId;
  const keyword = req.query.keyword;

  try {
    const articles = await getNewsByKeyword(keyword);
    res.render('news', { articles: articles, user: user ? user : null, })
  } catch (error){
    console.error(`Error making HTTPS request to news: ${error.message}`);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/search-news', async (req, res) => {
  const sessionId = req.session.userId;
 

  console.log(sessionId)
  const keyword = req.query.keyword;
  res.redirect(`/news?sessionId=${sessionId}&keyword=${keyword}`);
});
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFromDate() {
  const currentDate = new Date();
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(currentDate.getMonth() - 1);
  const fromDate = formatDate(lastMonthDate);

  return fromDate;
}

app.get('/apod', async (req, res) => {
 
  const user = req.session.userId;

  try {
    const apodData = await getAPOD();
    res.render('apod', { apod:  apodData, user: user ? user : null});
  } catch (error) {
    console.error('Error fetching APOD data:', error);
    res.render('apod', { apod: null, user: user ? user : null });
  }
});

async function getAPOD() {
  const responseNASA = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);
  return responseNASA.data;
}

async function getNewsByKeyword(keyword) {
  const fromDate = getFromDate();
  
  let responseNews, newsData = null;

  try {
      responseNews = await axios.get(`https://newsapi.org/v2/everything?q=${keyword}&searchIn=title&from=${fromDate}&language=en&sortBy=popularity&apiKey=${NEWS_API_KEY}`);
      newsData = responseNews.data;
  } catch (error){
      console.error(`Error making HTTPS request to weather: ${error.message}`);
      return null;
  }

  const articles = newsData.articles.slice(0, 10);
  if (!articles) {
    articles = null;
  }

  return articles;
}


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
