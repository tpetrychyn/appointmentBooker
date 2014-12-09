var express = require('express')
	, passport = require('passport') //authentication
	, FacebookStrategy = require('passport-facebook').Strategy //fb Oauth2
	, bodyParser = require('body-parser') //getting elements from jade
	, jade = require('jade')
	, cookieParser = require("cookie-parser")
	, session = require('express-session');

var FACEBOOK_APP_ID = "292262254317747"
var FACEBOOK_APP_SECRET = "ef84a0371315a048c7314e7573cae69f";

//connect to database
var Post = require('./models/post');
var Book = require('./models/bookings');
var User = require('./models/users');
var mongoose = require('mongoose');
var dbURL = 'mongodb://localhost/appointmentsdb';

mongoose.connect(dbURL);

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Facebook profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the FacebookStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Facebook
//   profile), and invoke a callback with a user object.
passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:5000/auth/facebook/callback",
    enableProof: false
  },
  function(accessToken, refreshToken, profile, done) {
  	//Check for user profile based on facebookId
    User.findOne( { facebookId: profile.id },
    	function(err, submission) {
    		if (err) console.log(err);
    		var changed = false;
    		//if not found create a new entry
    		if (!submission) {
    			changed = true;
    			submission = new User({
    				facebookId: profile.id,
    				name: profile.displayName,
    				picture: "https://graph.facebook.com/" + profile.id + "/picture" + "?width=200&height=200" + "&access_token=" + accessToken,
    				group: 'user'
    			
    			});
    		} else {
    			//This should update users names if they change it on FB, can't really test
    			if (submission.name != profile.displayName) {
    				changed = true;
    				submission.name = profile.displayName;
    			}
    		}
    		//if changes were made save it
    		if (changed){
    			submission.save(function(err) {
    				if (err) console.log(err);
    			});
    		}
    		//return the users info
    		return done(err, submission);
    	});
  	}
));

var app = express();

//to use jade
app.engine('html', jade.__express);
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: 'generate a random secret eventually' }));
//Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

/*var monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; //Array to hold month names
var monthLength = [31,28,31,30,31,30,31,31,30,31,30,31]; //Array to hold number of days in each month
var year = 2014;
var day = 6;

var output = "";

for (var i = 0; i < 12; i++) {
	output += monthName[i] + '<br>';
	output += "Sun&nbsp&nbspMon&nbsp&nbspTue&nbsp&nbspWed&nbsp&nbspThu&nbsp&nbspFri&nbsp&nbspSat <br>";
	for (var z=0;z<day*9;z++)
		output += '&nbsp';
	for (var x=1;x<=monthLength[i];x++) {
		if (x<10)
			output += '&nbsp&nbsp' + x + '&nbsp&nbsp&nbsp&nbsp&nbsp';
		else
			output += x + '&nbsp&nbsp&nbsp&nbsp&nbsp';
		day++;
		if (day===7) {
			output += '<br>';
			day = 0;
		}
	};
	output += '<br><br>';
};*/

app.get('/', function(req, res) {
  	Post.find(function(err, posts) {
		if (err) console.log(err);
		res.render('index', {
		title: 'Available Appointments',
		posts: posts,
		user: req.user
		});
	});
});

app.get('/login', function(request, response){
  response.render('login', { user: request.user });
});

// GET /auth/facebook
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Facebook authentication will involve
//   redirecting the user to facebook.com.  After authorization, Facebook will
//   redirect the user back to this application at /auth/facebook/callback
app.get('/auth/facebook',
  passport.authenticate('facebook', { display: 'touch' }));
/*app.get('/auth/facebook',
  passport.authenticate('facebook') { display : 'touch' },
  function(request, response){
    // The request will be redirected to Facebook for authentication, so this
    // function will not be called.
});*/

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
  	if (!req.user.phoneNumber)
  		res.redirect('/account');
  	else
    	res.redirect('/');
});

app.get('/account', function(req, res){
	if (req.user)
		res.render('account', {
		title: 'Account Settings',
		user: req.user
		});
	else
  		res.redirect('/');
});

app.post('/account', function(req, res) {
	console.log(req.body.pass_id);
	User.findOne( { facebookId: req.body.pass_id }, function(err, user) {
		if (err) console.log(err);
		if (!user) {
			res.redirect('/oops');
			return;
		}
			user.phoneNumber = req.body.phone_number;
			user.email = req.body.email_address;

			user.save(function(err) {
				if (err) console.log(err);
				else res.redirect('/');
			});
	});
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/bookings', function(request, response) {
  	Book.find(function(err, bookings) {
		if (err) console.log(err);
		response.render('bookings', {
		title: 'Current Appointments',
		bookings: bookings,
		user: req.user
		});
	});
});

app.get('/new', function(request, response) {
	response.render('new', {
		title: 'Add Appointment Time',
		user: req.user
	});
});

app.post('/new', function(request, response) {
	var newSlug = new Date().getTime();
	var post = new Post({
		appDateTime: request.body.app_date,
		comments: request.body.comments,
		slug: newSlug
	});

	post.save(function(err) {
		if (err) console.log(err);
		else response.redirect('/');
	});
});

app.get('/oops', function(request, response) {
	response.send('Oops something went wrong, press back and try again.');
});

app.post('/book', function(request, response) {
	var newSlug = new Date().getTime();
	Post.findOne({ slug: request.body.pass_slug }, function(err, post) {
		if (!post) {
			response.redirect('/oops');
			return;
		}
		var booking = new Book({
			appDateTime: post.appDateTime,
			name: request.body.user_name,
			email_address: request.body.email_address,
			phone_number: request.body.phone_number,
			comments: post.comments,
			slug: newSlug,
		});

		booking.save(function(err) {
			if (err) console.log(err);
			else response.redirect('/');
		});

		Post.remove({ slug: request.body.pass_slug }, function(err, post) {
			if (err) console.log(err);
		});
	});
});

app.post('/cancel', function(request, response) {
	var newSlug = new Date().getTime();
	if (request.body.keep_box) {
		Book.findOne({ slug: request.body.pass_slug }, function(err, booking) {
			if (err) console.log(err);
			if (!booking) {
				response.redirect('/oops');
				return;
			}
				var post = new Post({
					appDateTime: booking.appDateTime,
					comments: booking.comments,
					slug: newSlug
				});

				post.save(function(err) {
					if (err) console.log(err);
				});
		});
	}
	Book.remove({ slug: request.body.pass_slug }, function(err, booking) {
		if (!booking) {
			response.redirect('/oops');
			return;
		}
			if (err) console.log(err);
	});
	response.redirect('/');	
});

app.get('/:slug', function(request, response) {
	Post.findOne({ slug: request.params.slug }, function(err, post) {
		if (!post) {
			response.redirect('/oops');
			return;
		}
		if(err) console.log(err);
		else response.render('post', {
			post: post,
			user: request.user
		});
	});
});




/*app.get('/', function(request, response) {
  	Post.find(function(err, posts) {
		if (err) console.log(err);
		response.render('index', {
		title: 'welcome world',
		posts: posts
		});
	});
});

app.get('/new', function(request, response) {
	response.render('new', {
		title: 'Add new post'
	});
});
app.post('/new', function(request, response) {
	var post = new Post({
		title: request.body.post_title,
		body: request.body.post_body,
		slug: request.body.post_slug
	});

	post.save(function(err) {
		if (err) console.log(err);
		else response.redirect('/');
	});
});

app.get('/:slug', function(request, response) {
	Post.findOne({ slug: request.params.slug }, function(err, post) {
		if(err) console.log(err);
		else
		response.render('post', {
			title: post.title, 
			post: post
		});
	});
});*/

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}


