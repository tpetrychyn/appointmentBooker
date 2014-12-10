var express = require('express')
	, passport = require('passport') //authentication
	, FacebookStrategy = require('passport-facebook').Strategy //fb Oauth2
	, bodyParser = require('body-parser') //getting elements from jade
	, jade = require('jade')
	, cookieParser = require("cookie-parser")
	, session = require('express-session')
	, authConfig = require('./oauth.js');

//connect to database
var Post = require('./models/post');
var Book = require('./models/bookings');
var User = require('./models/users');
var mongoose = require('mongoose');
var dbURL = 'mongodb://taylorp:taytay@ds061370.mongolab.com:61370/heroku_app32339500';

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
    clientID: authConfig.facebook.clientID,
    clientSecret: authConfig.facebook.clientSecret,
    callbackURL: authConfig.facebook.callbackURL,
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
    		//I think nextTick is so we don't return before we've saved
    		process.nextTick(function() {
    			return done(err, submission);
    		});
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

app.get('/', function(req, res) {
  	Post.find().sort({'appDate': 1}).exec(function(err, posts) {
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

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
  	backURL=req.header('Referer') || '/';
  	if (!req.user.phoneNumber)
  		res.redirect('/account');
  	else
    	res.redirect(backURL);
});

app.get('/account', function(req, res){
	//Grab user from database, not needed on every page since it can be stored in session for quicker access
	if (!req.user) {
		res.redirect('/');
		return;
	}
	User.findOne( { facebookId: req.user.facebookId }, function(err, user) {
		if (err) {
			console.log(err);
			res.redirect('/');
			return;
		}
		Book.find( { facebookId: req.user.facebookId }, function(err, bookings) {
			if (err) console.log(err);
			res.render('account', {
				title: 'Account Settings',
				user: user,
				bookings: bookings
			});
		});
	});
});

app.post('/account', function(req, res) {
	User.findOne( { facebookId: req.body.pass_id }, function(err, user) {
		if (err) console.log(err);
		if (!user) {
			res.redirect('/oops');
			return;
		}

		if (validatePhone(req.body.phone_number))
			user.phoneNumber = req.body.phone_number;
		else
			console.log('invalid phone number - do something with this soon');

		if (validateEmail(req.body.email_address))
			user.email = req.body.email_address;
		else
			console.log('invalid email');

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

app.get('/bookings', function(req, res) {
	if (!req.user){
		res.redirect('/');
		return;
	}
	if (!req.user.group == 'admin') {
		res.redirect('/');
		return;
	}
  	Book.find().sort({'appDate': 1}).exec(function(err, bookings) {
		if (err) console.log(err);
		res.render('bookings', {
		title: 'Current Appointments',
		bookings: bookings,
		user: req.user
		});
	}, {"sort": "dec"});
});

app.get('/new', function(req, res) {
	res.render('new', {
		title: 'Add Appointment Time',
		user: req.user
	});
});

app.post('/new', function(req, res) {
	var newSlug = new Date().getTime();
	var post = new Post({
		appDate: req.body.app_date,
		appTime: req.body.app_time,
		comments: req.body.comments,
		slug: newSlug
	});

	post.save(function(err) {
		if (err) console.log(err);
		else res.redirect('/');
	});
});

app.post('/cancel', function(req, res) {
	var newSlug = new Date().getTime();
	if (req.body.keep_box) {
		Book.findOne({ slug: req.body.pass_slug }, function(err, booking) {
			if (err) console.log(err);
			if (!booking) {
				res.redirect('/oops');
				return;
			}
			var post = new Post({
				appDate: booking.appDate,
				appTime: booking.appTime,
				comments: booking.comments,
				slug: newSlug
			});

			post.save(function(err) {
				if (err) console.log(err);
			});
		});
	}
	Book.remove({ slug: req.body.pass_slug }, function(err, booking) {
		if (err) console.log(err);
		if (!booking) {
			res.redirect('/oops');
			return;
		}
	});
	res.redirect('/');
});

app.get('/oops', function(req, res) {
	res.send('Oops something went wrong, press back and try again.');
});

app.post('/book', function(req, res) {
	var newSlug = new Date().getTime();
	Post.findOne({ slug: req.body.pass_slug }, function(err, post) {
		if (!post) {
			res.redirect('/oops');
			return;
		}
		if (!validateEmail(req.body.email_address)) {
			res.redirect('/oops');
			return;
		}
		if (!validatePhone(req.body.phone_number)) {
			res.redirect('/oops');
			return;
		}
		var booking = new Book({
			appDate: post.appDate,
			appTime: post.appTime,
			name: req.body.user_name,
			facebookId: req.body.pass_id,
			email_address: req.body.email_address,
			phone_number: req.body.phone_number,
			comments: post.comments,
			slug: newSlug,
		});

		booking.save(function(err) {
			if (err) console.log(err);
			else res.redirect('/');
		});

		Post.remove({ slug: req.body.pass_slug }, function(err, post) {
			if (err) console.log(err);
		});
	});
});

app.get('/:slug', function(req, res) {
	Post.findOne({ slug: req.params.slug }, function(err, post) {
		if (!post) {
			res.redirect('/oops');
			return;
		}
		if(err) console.log(err);
		else res.render('post', {
			post: post,
			user: req.user
		});
	});
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

function validateEmail(email) {
	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(email);
}

function validatePhone(phone) {
	var re = /^[(]{0,1}[0-9]{3}[)]{0,1}[-\s\.]{0,1}[0-9]{3}[-\s\.]{0,1}[0-9]{4}$/;
	return re.test(phone);

}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}
