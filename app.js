var express = require('express')
var app = express()
var socket = require('socket.io');
var _ = require('lodash');
const path = require('path')
const bodyParser = require('body-parser')
const logger = require('morgan')
const session = require('express-session');


const passport = require('passport')
// MongoDB Driver
const mongoose = require('mongoose')
const { redirect } = require('express/lib/response')

var server = app.listen(4000, function(){
	console.log('4000 portu dinleniyor');
});

const DB_URI = "mongodb://localhost:27017/use" // mongodb://domain:port/database-name

// Connect to MongoDB
mongoose.connect(DB_URI)

// CONNECTION EVENTS
mongoose.connection.once('connected', function() {
    console.log("Database connected to " + DB_URI)
})
mongoose.connection.on('error', function(err) {
    console.log("MongoDB connection error: " + err)
})
mongoose.connection.once('disconnected', function() {
    console.log("Database disconnected")
})

// If Node's process ends, close the MongoDB connection
process.on('SIGINT', function() {
    mongoose.connection.close(function() {
        console.log("Database disconnected through app termination")
        process.exit(0);
    })
})

// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// Serve Static Files from /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    name: 'sessionId',
    secret: "mysecretkeythatiwillnottellyou",
    saveUninitialized: false, // don't create sessions for not logged in users
    resave: false, //don't save session if unmodified
    
    // Where to store session data
   
    // cookies settings
    cookie: {
    	secure: false,  
    	httpOnly: false, // if true, will disallow JavaScript from reading cookie data
    	expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour;
    }
}))
// Passport Config
require('./config/passport')(passport); // pass passport for configuration
// Passport init (must be after establishing the session above)
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Pass 'req.user' as 'user' to ejs templates
// Just a custom middleware
app.use(function(req, res, next) {
  res.locals.user = req.user || null;
  // res.locals is an object available to ejs templates. for example: <%= user %>
  next();
})

app.get("/cart.ejs",function(req,res){
    res.render ("cart");
});

app.get("/checkout.ejs",function(req,res){
    res.render ("checkout");
});

app.get("/contact.ejs",function(req,res){
    res.render ("contact");
});

app.get("/login.ejs",function(req,res){
    res.render ("login");
});

app.get("/product-detail.ejs",function(req,res){
    res.render ("product-detail");
});

app.get("/product-list.ejs",function(req,res){
    res.render ("product-list");
});

app.get("/wishlist.ejs",function(req,res){
    res.render ("wishlist");
});

app.get("/my-account.ejs",function(req,res){
    res.render ("my-account");
});

app.get("/member.ejs",function(req,res){
    res.render ("member");
});

app.get("/",function(req,res){
    res.render ("index");
});

app.get("/profile.ejs",function(req,res){
    res.render ("profile");
});

app.post("/profile.ejs",function(req,res){
    res.redirect ("/");
});

app.get("/chat.ejs",function(req,res){
    res.render ("chat");
});

var io = socket(server);
var kullanicilar = [];
var odalar = ['Oda 1','Oda 2','Oda 3'];
//var odalar = [
//	{name:"Oda 1",bg:"yellow"},
//	{name:"Oda 2",bg:"red"},
//	{name:"Oda 3",bg:"blue"}
//]
io.on('connection',function(socket){
	socket.emit('odalar',odalar);
	console.log('socket baglantısı kuruldu', socket.id);
	socket.on('isimgir', function(ad){
		if (_.find(kullanicilar,{kullanici:ad})||ad==null) {
			socket.emit('alert',{
				value:"Lütfen başka bir isim seçin!!!"
			})
			socket.emit('connectagain');
		} else {
    	socket.ad = ad;
    	//kullanicilar[socket.ad] = ad;
    	socket.oda = 'Oda 1';
    	kullanicilar.push({
    		kullanici:socket.ad,
    		userid:socket.id,
    		socket:socket
    	});
    	console.log('kullanicilar uzunluğu>>>>>>>>----->>>>',kullanicilar.lenghth);
    	socket.join('Oda 1');
    	socket.emit('chatguncelle', 'SERVER', 'Oda 1 e bağlandınız.');
    	socket.broadcast.to(socket.oda).emit('chatguncelle', 'SERVER', ad + ' bu odaya bağlandı.');
    	socket.emit('odaguncelle', odalar, 'Oda 1');
    	var s =_.map(kullanicilar,function(o){
    		var obj={}
			obj.name=o.kullanici;
			obj.id=o.userid;
			return obj;
		})
		io.sockets.emit('kisiguncelle', s);
		console.log('isim ve id:',s);
		console.log('socket.ad:',socket.ad);
	}
});
	//MESAJ
	socket.on('mesajgonder', function(data){
		var gelenmesaj = data.mesaj;
		console.log("asdqwe >>>>",data);
		if (gelenmesaj == "" || gelenmesaj == undefined) {
			socket.emit('alert',{
				value:"Boş mesaj atamazsın!!!"
			})
		}
		else
		{
			io.sockets.in(socket.oda).emit('chatguncelle', socket.ad, data);
		}
	});
	//ODALAR ARASINDA GEÇİŞ
	socket.on('odadegis', function(yenioda){
		socket.leave(socket.oda);	
		socket.join(yenioda);
		console.log(yenioda);
		socket.emit('chatguncelle', 'SERVER', yenioda+ ' e bağlandınız.');
		socket.broadcast.to(socket.oda).emit('chatguncelle', 'SERVER ', socket.ad+' bu odadan ayrıldı.');
		socket.oda = yenioda;
		socket.broadcast.to(yenioda).emit('chatguncelle', 'SERVER ', socket.ad+' bu odaya katıldı.');
		socket.emit('odaguncelle', odalar, yenioda);

	});
	//ÖZEL MESAJ
	socket.on('ozelmesaj', function(data){
		var a = _.find(kullanicilar,{userid:data.id});
		console.log('id datası:',data.id);
		a.socket.emit('privatemessage',{
			msj:data.msj,
			ad:socket.ad,
			id:socket.id,
			renk:data.renk
		});
		console.log('ozelmesaj icin gelen renk:',data.renk);
	});
	//DİSCONNECT
	socket.on('disconnect', function(){
		_.pullAllWith(kullanicilar, [{
			kullanici:socket.ad,
			userid:socket.id,
			socket:socket
		}], _.isEqual);

		var s =_.map(kullanicilar,function(o){
			var obj={}
			obj.name=o.kullanici;
			obj.id=o.userid;
			return obj;
		})
		console.log('kalanlar:',kullanicilar);
		io.sockets.emit('kisiguncelle', s);
		socket.broadcast.to(socket.oda).emit('chatguncelle', 'SERVER', socket.ad + ' kişisinin bağlantısı koptu');
		socket.leave(socket.oda);
	});

});








// Routes ----------------------------------------------
app.use('/api/posts', require('./routes/api-posts'))
app.use('/auth', 	  require('./routes/auth'))
app.use('/', 		  require('./routes/pages'))
// -----------------------------------------------------



