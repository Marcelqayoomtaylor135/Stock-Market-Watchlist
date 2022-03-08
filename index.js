// Index JS is the main javascript file of the project. It controls all of the main functions and page rendering

// The first section of index.JS defines and establishes the variables that stem from external packages

const express = require('express'); 
var cookieParser = require('cookie-parser');
const bodyParser = require('body-parser'); 
const mongoose = require('mongoose');
var MongoClient = require('mongodb').MongoClient
var Chart = require('chart.js');
var async = require("async");
const db = "mongodb+srv://Marcel:Marcel@cluster0-hlbs5.mongodb.net/userdatabase?retryWrites=true&w=majority";
var path = require('path'); // Functions for grabbing files/folders
const request = require('request'); // Allows you to make API requests
const apiKey = 'GV8VTHLJ4D7ZVQCV'; // API KEY
const app = express(); // Start using express library functions to make an application called "app"
const bcrypt = require('bcrypt');
let SALT = 10; // Global variable for the amount of characters of the cryptography   
var session = require('express-session'); 
var unix = require('unix-timestamp');
var stringSlice = require('string-slice');

// Global arrays that keep track of the user's stocks to add to the database

var stockCodes = [];
var stockNames = [];

//connect to mongoDB
mongoose
  .connect(db, {useNewUrlParser: true})
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch(err => {
    console.log(err);
    console.log('MongoDB Not Connected');
  });

// A template for making new users

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  username: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
	watchlistCodes: {
		type: Array,
		required: false,
	},
	watchlistNames: {
		type: Array,
		required: false,
	},

});

// Hashing the password before saving to database

UserSchema.pre('save', function(next){
	var user = this;
	if(user.isModified('password')){
		bcrypt.genSalt(SALT, function(err,salt){
			if(err) return next(err);

			bcrypt.hash(user.password, salt, function(err,hash){
				if(err) return next(err);
				user.password = hash;
				next();
			})
		})
	} else {
		next()
	}
})

// Method for comparing passwords with the Hashed equivilent

UserSchema.methods.comparePassword = function(candidatePassword, checkpassword){
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch){
		if(err) return checkpassword(err)
		checkpassword(null, isMatch)
	})
}

// Create a model for users
var User = mongoose.model('User', UserSchema);
module.exports = User;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.json()); //using Parser engine to be able to translate and read json data
app.use(bodyParser.urlencoded({ extended: true })); // Ensures json data is encoded the right way

app.use(express.static('public'));
 // Use a static directory named public that stores static files (stuff that doesnt change for the user e.g images, css code)

app.use(cookieParser());

app.use(session({
	resave: true, 
	saveUninitialized: true, 
	secret: "sdsdsdsds"
	}));

// Global variable to establish sessions via express sessions

var sess; 


// The next section are all the main functions of the program


// Retrieves the data for a company via an API 

function GetCompanyData(companySymbol, selectedRange, req, res) {

	if (companySymbol.length >= 100 || companySymbol.length <= 0) {
		res.render('searchresults', {
			searchResults: [],
			testSymbol: [],
			error: "Company symbol is too long",
		});	
	} else {
		// The object "options" will be recurrent to define the query data for the API

		var options = {
			method: 'GET',
			url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/get-detail',
			qs: {region: 'US', lang: 'en', symbol: companySymbol},
			headers: {
				'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
				'x-rapidapi-key': '0a847f1d00msh69cb4807c6bb658p1cbc84jsn7805244c30b5'
			}
		};

		request(options, function (error, response, body, req) {
			if (error) throw new Error(error);
			var data = {};

			try {
				data = JSON.parse(body);								
				var rangeLabel = "";
				if (selectedRange == "1d" || selectedRange == "5d"){
					rangeLabel = "Days";
				} else if (selectedRange == "1mo" ||selectedRange == "3mo" || selectedRange == "6mo"){
					rangeLabel = "Months";
				} else if (selectedRange == "1y" || selectedRange == "2y" || selectedRange == "5y" || selectedRange == "10y"){
					rangeLabel = "Years";
				} else {
					rangeLabel = "";
				}

				if (data["defaultKeyStatistics"] == undefined){ 
					res.render('searchresults', {
						searchResults: [],
						testSymbol: [],
						error: "No data found for that company",
					});	
				} else {
					companySymbol = data["quoteType"]["symbol"];
					selectedInterval = "";
					if (selectedRange == '1d'){
						selectedInterval = "15m";
						console.log("selected interval is: " + selectedInterval)
					} else if (selectedRange == '5d'){
						console.log("selected interval is: " + selectedInterval)
						selectedInterval = "60m";
					} else {
						console.log("selected interval is: " + selectedInterval)
						selectedInterval = "1d";
					}

					var options2 = {
						method: 'GET',
						url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-chart',
						qs: {interval: selectedInterval, region: 'US', symbol: companySymbol, lang: 'en', range: selectedRange},
						headers: {
							'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
							'x-rapidapi-key': '0a847f1d00msh69cb4807c6bb658p1cbc84jsn7805244c30b5',
							useQueryString: true
						}
					};

					request(options2, function (error, response, body, req) {
						if (error) throw new Error(error);
						try {
							apiData = JSON.parse(body);

							var graphData = {
								selectedRange: selectedRange,
								rangeLabel: rangeLabel,
								priceArray: [],
								dateArray: [],
								newDateArray: [],
								newPriceArray: [],
								ranges: ["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"],
							}
					
							length = apiData["chart"]["result"][0]["indicators"]["quote"][0]["close"].length;

							for (i = 0; i < length; i++)
							{
								graphData.priceArray.push(JSON.stringify(apiData["chart"]["result"][0]["indicators"]["quote"][0]["close"][i]));
								graphData.dateArray.push(JSON.stringify(unix.toDate(apiData["chart"]["result"][0]["timestamp"][i])));
							}
							
							for (i = 0; i < graphData.dateArray.length; i++){
								if (selectedRange == '1d' ){
									newDate = stringSlice(graphData.dateArray[i], 12, 17)
									graphData.newDateArray.push(newDate)
								} else if (selectedRange == '5d'){
									newDate = stringSlice(graphData.dateArray[i], 6, 17)
									graphData.newDateArray.push(newDate)
								} else if (selectedRange == '1mo' || selectedRange == '3mo'){
									newDate = stringSlice(graphData.dateArray[i], 6, 11)
									graphData.newDateArray.push(newDate)
								} 
								else if (selectedRange == '6mo'
									|| selectedRange == '1y' || selectedRange == '2y' || selectedRange == '5y' || selectedRange == '10y' || selectedRange == 'ytd')
								{
									newDate = stringSlice(graphData.dateArray[i], 1, 10)
									graphData.newDateArray.push(newDate)
								} else if (selectedRange == 'max'){
									newDate = stringSlice(graphData.dateArray[i], 1, 5)
									graphData.newDateArray.push(newDate)
								} 
								else {					
									newDate = stringSlice(graphData.dateArray[i], 0, 17);
									graphData.newDateArray.push(newDate)
								}
							}

							for (i = 0; i < graphData.priceArray.length; i++){
								newPrice = stringSlice(graphData.priceArray[i], 0, 8);
								graphData.newPriceArray.push(newPrice)
							}

							RenderCompanyPage(data, graphData, req, res);
						} catch (e) {
							res.render('searchresults', {
								searchResults: [],
								testSymbol: [],
								error: "There was an error with the API, please refresh the page and try again",
							});	
						}
					});
				}
			} catch (e) {
				res.render('searchresults', {
					searchResults: [],
					testSymbol: [],
					error: "There was an error with the API, please refresh the page and try again",
				});	
			}
		});
  }
}

function ConvertTimeFrame(timeFrame) {
  if (timeFrame == undefined){
    timeFrame == "Error, please try refresh the page";
  }
  else if (timeFrame == "TIME_SERIES_DAILY") {
    timeFrame = "Time Series (Daily)";
  }
}


function RenderCompanyPage(results, graphData, req, res)  {	
	res.render('company', {
		companyName: results["quoteType"]["shortName"],
		companySymbol: results["quoteType"]["symbol"],
		close: results["price"]["regularMarketPrice"]["fmt"],
		open: results["price"]["regularMarketOpen"]["raw"],
		change: results["price"]["regularMarketChangePercent"]["fmt"],
		high: results["summaryDetail"]["regularMarketDayHigh"]["fmt"],
		low: results["summaryDetail"]["regularMarketDayLow"]["fmt"],
		volume: results["summaryDetail"]["regularMarketVolume"]["fmt"],
		selectedRange: graphData.selectedRange,
		rangeLabel: graphData.rangeLabel,
		chartLabel: results["quoteType"]["shortName"],
		prices: graphData.newPriceArray,
		dates: graphData.newDateArray,
		ranges: graphData.ranges,
		error: null,
	});
}


function AddToWatchlist(companySymbol, req, res) {

	var apiUrl = 'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=' + companySymbol +'&apikey=' + apiKey;

	if (companySymbol.length > 0){
		request(apiUrl, function(err, response, body){
			if(err){ // If error exists
				res.render('searchresults', {
					searchResults: [],
					testSymbol: [],
					error: "Data could not be fetched",
				});	
			} else {
				// Fetches and turns data to JSON format

				
				try {
					data = JSON.parse(body);
				} catch (e) {
					res.render('searchresults', {
						searchResults: [],
						testSymbol: [],
						error: "There was an error with the API, please refresh the page and try again",
					});	
				}
				if(data["bestMatches"][0] == undefined){ 
					res.render('searchresults', {
						searchResults: [],
						testSymbol: [],
						error: "Data undefined",
					});	
				} else {

					var listItem = {
						companyName: data["bestMatches"][0]["2. name"],
						companyCode: data["bestMatches"][0]["1. symbol"],
					}
					
					User.findOne({'username': sess.username.toLowerCase()}, (err, user) => {
						if (!user) res.json({message:"failed to find " + sess.username})
						if (user) {

							// Connects to database

							MongoClient.connect(db, function(err, db) { 
								if (err) {
									res.redirect('/watchlist');
									throw err;
								} 

								var dbo = db.db("userdatabase");
								
								var myquery = { username: sess.username.toLowerCase() };

								var newvalues = { $addToSet: {watchlistCodes: listItem.companyCode,
								 watchlistNames: listItem.companyName}
								 };

								dbo.collection("users").updateOne(myquery, newvalues, function(err) {
									if (err) {
										res.redirect('/watchlist');
										throw err;
									} 
									console.log("1 document updated");
									db.close();
									res.redirect("/watchlist");
								});
							});
						}
					})
					}
				}
		});
	}	else{
		res.render('searchresults', {
			searchResults: [],
			testSymbol: [],
			error: "Company symbol entered is invalid",
		});	
	}

}

// Removes stock from watchlist

function RemoveFromWatchlist(companySymbol, req, res){

	var apiUrl = 'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=' + companySymbol +'&apikey=' + apiKey; 


	if (companySymbol.length > 0){
		request(apiUrl, function(err, response, body){
			if(err){ // If error exists
				res.render('searchresults', {
					searchResults: [],
					testSymbol: [],
					error: "An error has occured with the API please try again later",
				});	
			}	else { 
					try {
						data = JSON.parse(body);
					} catch (e) {
						res.render('searchresults', {
							searchResults: [],
							testSymbol: [],
							error: "There was an error with the API, please refresh the page and try again",
						});	
					}
					if(data == undefined){ 
						res.render('searchresults', {
							searchResults: [],
							testSymbol: [],
							error: "No data was found for that company",
						});	
					}	else {
						var listItem = {
							companyName: data["bestMatches"][0]["2. name"],
							companyCode: data["bestMatches"][0]["1. symbol"],
							}
						var completeStock = listItem.companyName + " (" + listItem.companyCode + ")"
						
						User.findOne({'username': sess.username.toLowerCase()}, (err, user) => {
							if (!user) res.json({message:"failed to find " + sess.username})
							if (user){

								// connects to database

								MongoClient.connect(db, function(err, db) { 

									if(err){ // If error exists
										res.render('searchresults', {
											searchResults: [],
											testSymbol: [],
											error: "An error occured trying to connect to the database",
										});	
									}

									var dbo = db.db("userdatabase");
									
									var myquery = { username: sess.username.toLowerCase() };

									var removalValues = { $pull: {watchlistCodes: listItem.companyCode,
									watchlistNames: listItem.companyName}
									};

									// Directly searches and updates user database

									dbo.collection("users").updateOne(myquery, removalValues, function(err) {
										if(err){ // If error exists
											res.render('searchresults', {
												searchResults: [],
												testSymbol: [],
												error: "An error occured updating the database, please try later",
											});	
										}
										db.close();
										res.redirect("/watchlist");
									});
								});	
							}
						})
				}
			}
		});
	} else{
		res.render('searchresults', {
			searchResults: [],
			testSymbol: [],
			error: "Invalid request, please try again",
		});	
	}
}

// A function for updating a user's password

function ChangePassword(currentPassword, newPassword, req, res) {

	// Checks if passwords fit minimum requirements

	if (currentPassword.length >= 8 || newPassword.length >= 8){

		// Encrypts new password and compares the current password to database
		bcrypt.genSalt(SALT, function(err,salt){
			if(err) return next(err);

			bcrypt.hash(newPassword, salt, function(err,hash){
				if(err) return next(err);
				newPassword = hash;
				User.findOne({'username': sess.username.toLowerCase()}, (err, user) => {
					if (user){
						user.comparePassword(currentPassword.toLowerCase(), (err, isMatch)=> {
							if(!isMatch){
								res.render('user', {
									error: "The 'current password' field doesn't match your current password",
									success: "",
									user: sess.username,
								});
							};
							if(isMatch){
									MongoClient.connect(db, function(err, db) { 
										if (err) throw err;
										var dbo = db.db("userdatabase");
										
										var myquery = { username: sess.username.toLowerCase() };

										var newvalues = { $set: {password: newPassword}
										};

									 	// updates databse to swap current password for new password
										dbo.collection("users").update(myquery, newvalues, function(err) {
											if (err) throw err;
											db.close();
											res.render("user", {
												error: "",
												success: "Password has been updated",
												user: sess.username,
											});
										});
										
									});
							}
						});
				} else {
					res.render('user', {
						error: "An issue has occured within the database, please try again later",
						success: "",
						user: sess.username,
					});
					}
				});
			})
		})
	} else {
			res.render('user', {
				error: "New password dont meet minimum requirements",
				success: "",
				user: sess.username,
			});
	}
}


// The next section of the index.JS file handles get requests

// When a homepage request is made:

app.get('/', function (req, res)  {
	sess = req.session;
	sess.username;

	// If a user is logged in 
	if(sess.username){
		res.redirect('/watchlist');
	} else {
		res.render('landing', {});
	}
	
});

// When a watchlist request is made:

app.get('/watchlist', function (req, res) { 

		sess = req.session;
		
		// Keeps track of user's visted packages

		if(!req.session.visitcount){
			req.session.visitcount = 1;
		} else {
			req.session.visitcount++; 
		}
		
		if(sess.username) {
			
			// Find user in database

			User.findOne({'username': sess.username.toLowerCase()}, (err, user) => {
				if (!user) res.json({message:"failed to find " + sess.username})
				if (user){
					
					var trendingStocks = [];

					var options = {
						method: 'GET',
						url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/get-trending-tickers',
						qs: {region: 'US'},
						headers: {
							'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
							'x-rapidapi-key': '0a847f1d00msh69cb4807c6bb658p1cbc84jsn7805244c30b5',
							useQueryString: true
						}
					};

					request(options, function (error, response, body) {
						if (error) throw new Error(error);
						try {
							data = JSON.parse(body);
						} catch (e) {
							res.render('searchresults', {
								searchResults: [],
								testSymbol: [],
								error: "There was an error with the API, please refresh the page and try again",
							});	
						}
						var stockLength = data["finance"]["result"][0]["count"]
						var stockObjects = data["finance"]["result"][0]["quotes"]

						// Manages the number of stocks displayed in the recommended stocks table to avoid overflow

						if (stockLength > 0){
							var displayCount = stockLength
							if (stockLength > 10) {
								displayCount = 10
							} else {
								displayCount = stockLength
							}
							for (var i = 0; i < displayCount; i++ ){
								if (data["finance"]["result"][0]["quotes"][i]["quoteType"] == "EQUITY"){ 
									trendingStocks.push(stockObjects[i])
								}					
							}
							// Render watchlist page 		
							res.render('watchlist', {
								username: sess.username,
								error: null,
								stockCodes: user.watchlistCodes,
								stockNames: user.watchlistNames,
								stonks: trendingStocks,
							});
						} else {
								res.render('watchlist', {
								username: sess.username,
								error: null,
								stockCodes: user.watchlistCodes,
								stockNames: user.watchlistNames,
								stonks: "Currently no trending stocks",
							});
						}

					});		
				}
			});
		} else {
			res.render('login', {
				error: "An error has occured, please re-login",
			});
		}

});

// When a user page request is made:

app.get('/user', function (req, res)  {
  res.render('user', {
		error: null,
		success: "",
		user: sess.username,
  });
});

// When a settings page request is made:

app.get('/settings', function (req, res)  {
  res.render('settings', {
		error: null,
  });
});

// When a premium page request is made:

app.get('/premium', function (req, res)  {
  res.render('premium', {
		error: null,
  });
});

// When a tutorial page request is made:

app.get('/tutorial', function (req, res)  {
  res.render('tutorial', {
		error: null,
  });
});

// When a signup page request is made:

app.get('/signup', function (req, res)  {
  res.render('signup', {
		error: null,
  });
});

// When a login page request is made:

app.get('/login', function (req, res)  {
  res.render('login', {
		error: null,
  });
});

// When a about page request is made:

app.get('/about', function (req, res)  {
  res.render('about', {
  });
});

// When a contact page request is made:

app.get('/contact', function (req, res)  {
  res.render('contact', {
  });
});

// When a search results page request is made:

app.get('/searchresults', function (req, res)  {
  res.render('searchresults', {
		searchResults: [],
		testSymbol: [],
		error: "no company found",
  });
});





// The next section of the index.JS file handles postrequests


// Controls user search input, calls the company code function

app.post('/companySearch', (req, res) => {

	var companyInput = req.body.companyInput;
	sess = req.session;
	sess.username;

	var options = {
		method: 'GET',
		url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/auto-complete',
		qs: {lang: 'en', region: 'US', query: companyInput},
		headers: {
			'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
			'x-rapidapi-key': '0a847f1d00msh69cb4807c6bb658p1cbc84jsn7805244c30b5'
		}
	};

	request(options, function (error, response, body, req) {

		// Defines the variables required for acquring the recommended stock list 

		var searchResults = [];
		var symbolFound = false;
		var companySymbol = [];

		if (error) throw new Error(error);
		try {
			data = JSON.parse(body);

			// Handles if no recommended stocks are retrieved 

			if (data["ResultSet"]["Result"][0] == undefined){
				res.render('searchresults', {
					searchResults: [],
					testSymbol: [],
					error: "no company found",
				});
			} else {
				searchData = data["ResultSet"]["Result"]
				
				for (var i = 0; i < searchData.length; i++ ){

					completeStock = (searchData[i]["name"] + " (" + searchData[i]["symbol"] + ")");
					searchResults.push(completeStock);
					companySymbol.push(searchData[i]["symbol"]);
					
					// Checks if user input matches an exact stock else produces search results
					if (options.qs.query.toUpperCase() == searchData[i]["symbol"] || options.qs.query == searchData[i]["name"]) {
						stockSymbol = searchData[i]["symbol"];
						symbolFound = true;
						GetCompanyData(stockSymbol, "1mo", req, res);
					}
				}

				// If no exact company was found, show search results
				if (symbolFound == false){
					res.render('searchresults', {
						searchResults: searchResults,
						testSymbol: companySymbol,
						error: "",
					});				
				} 	
			}
		} catch (e) {
			res.render('searchresults', {
				searchResults: [],
				testSymbol: [],
				error: "There was an error with the API, please refresh the page and try again",
			});	
		}
	});	
});


// Handles post request for adding stocks

app.post('/addStock', (req, res) => {
	sess = req.session;
	sess.username;
	var newStock = req.body.stockinput;
	AddToWatchlist(newStock, req, res)
});

app.post('/addStock/:stock', (req, res) => {
	sess = req.session;
	sess.username;
	// take the input make it into link 
	var newStock =  req.params.stock;
	AddToWatchlist(newStock, req, res)

});


// Handles post request for new users signing up

app.post('/signup', (req, res) => {
	
	sess = req.session;
	sess.username = req.body.username.toLowerCase();

	var signupData = {
		email: req.body.email,
		username: req.body.username,
		password: req.body.password,
	}

	var passwordRequirements = 
	{
		minimumLength: 8,
	}
	
	var issues = [];
	
	if (signupData.password.length <= passwordRequirements.minimumLength)
	{
		issues.push("Password must be at least " + passwordRequirements.minimumLength + " characters long")
		res.render('signup', {
			error: issues,
		});
	} else {
		// Creates new user given data
		const user = new User ({
			email: signupData.email.toLowerCase(),
			username: signupData.username.toLowerCase(),
			password: signupData.password.toLowerCase(),
			watchlistCodes: [],
			watchlistNames: [],
		}).save((err, response) => {
			if(err) res.status(400).send(err)
			else {
				res.redirect("/")
			}
		})
	}
});

// Handles post request for logging in

app.post('/login', (req, res) => {
	sess = req.session;
	var loginData = {
		username: req.body.username,
		password: req.body.password,
	}
	sess.username = loginData.username.toLowerCase();
	console.log("Session username: " + sess.username);
	User.findOne({'username': sess.username.toLowerCase()}, (err, user) => {
		if (!user) {
			res.render('login', {
				error: "Login failed, please ensure username is spelled correctly",
			});
		} else {
			user.comparePassword(req.body.password.toLowerCase(), (err, isMatch)=> {
				if(!isMatch){
					res.render('login', {
						error: "Login failed, please ensure password is spelled correctly",
					});
				};
				if(isMatch){
					res.redirect("/watchlist");
				}
			})
		}

		// if email present then compare password


	})
});

// Handles post request for logging out

app.post('/logout', (req, res) => {
	sess = req.session;
	req.session.destroy((err) => {
		if (err) {
			return console.log(err);
		}
		res.redirect('/')
	})
});

// Handles post request for selecting stocks from the watchlist

app.post('/stockWatchlist/:stock', (req, res) => {
	var companySymbol = req.params.stock;
	GetCompanyData(companySymbol, "1mo", req, res);	
});


// Handles post request for selecting a new range for graphs

app.post('/graphData/:selectedRange', (req, res) => {
	var companySymbol = req.body.companySymbol;
	var selectedRange = req.params.selectedRange;
	GetCompanyData(companySymbol, selectedRange, req, res)
});

// Handles post request for removing stocks

app.post('/removeStock/:stock', (req, res) => {
	var companySymbol = req.params.stock;
	RemoveFromWatchlist(companySymbol, req, res)
});

// Handles post requests for changing password

app.post('/changePassword', (req, res) => {
	var currentPassword = req.body.currentPassword;
	var newPassword = req.body.newPassword;
	ChangePassword(currentPassword, newPassword, req, res);
});


app.listen(3000, () => console.log('Server started'));


