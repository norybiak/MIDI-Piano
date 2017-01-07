// Author: Kai Byron (NorybiaK)
// Advisor/Assistance/Tester: Matthew (VMU_Kiss)
// Version: 0.2.0

var MidiPiano = MidiPiano || {};

(function(main, alt) 
{ 'use strict';

	//The index of each array corresponds to the note, thus objects and data can be stored separately.
	var keyObjects = []; //Each object
	var keyData = [];	//Data about that object
	
	//Altspace stuff
	var spaceName = '';
	var spaceSID = '';
	var mobile = /mobile/i.test(navigator.userAgent);
	
	var skeleton;
	
	//Colors used for the notes
	var noteDownColor = new THREE.Color(0xFF0000);  //Red
	var noteWUpColor = new THREE.Color(0xFFFFFF);   //White
	var noteBUpColor = new THREE.Color(0x000000);   //Black
	
	//full piano key setup
	var yPosFromStage = 48;
	var xPos = -217;
	var yPos = -270;
	var zPos = 240;
	var scale = 3;
	var whiteDistance = 8.5;
	var blackDistance = 4.2;
	var blackPosOffset = 3;
	var prevKey = '';
	var prevRotation = false;
	var whiteKeyGeometry;
	var blackKeyGeometry;

	//Piano
	var piano;
	var pianoPosition;
	var pianoRotation;
	
	//grouper
	var pianoGroup = new THREE.Group();
	
	//controls
	var ctrlObjects = [];
	var volCtrlGroup = new THREE.Group();
	var playCtrlGroup = new THREE.Group();
	var mute = false;
	var volume = 5;
	var muteText;
	var unmuteText;
	var gray = new THREE.Color(0x9f9f9f);
	var yellow = new THREE.Color(0xf0ff00);
	
	var scene;
	
	//Instance Data
	var instanceData;
	var instanceUsers;
	var users = {};
	var currentSong = 0;
	var keysPressed = [];
	
	//User
	var userID;
	var colorUser;
	var noteColorUserDown;
	var startedPlayer = false;
	var startCurrentTimeLoop = false;
	var loadingFirstTime = true;

	//Song file, title, speed
	var songs = 
	[
		{file: "mozart_sonata_2-pianos_375_1_(c)ishenko.mid", title: "Sonata in D major, for two - Mozart", speed: 1},
		{file: "517-Scarlatti.mid", title: "Sonata in D minor, K. 517 - Scarlatti", speed: 0.5},
		{file: "HungarianRhapsodyNo10S24410.mid", title: "Hungarian Rhapsody No. 10, S. 244/10", speed: 1},
		{file: "Roslin_Adama.mid", title: "Roslin & Adama - Bear McCreary", speed: 1},
		{file: "ParagonX9_Chaoz_Fantasy.mid", title: "Chaoz Fantasy - ParagonX9", speed: 1},
		{file: "swordland_1.mid", title: "Swordland (SAO) - Yuki Kajiura", speed: 1},
		{file: "9725s_maple_leaf_rag_(nc)smythe.mid", title: "Maple Leaf - Scott Joplin", speed: 1},
		{file: "hes_a_pirate.mid", title: "He's a Pirate - Klaus Badelt", speed: 1},
		{file: "touhou.mid", title: "U.N. Owen Was Her? - ZUN", speed: 1},
		{file: "cruel_angel.mid", title: "Cruel Angel - Neko Oikawa", speed: 1},
		{file: "tchaikovsky_nutcracker_act-1_2_march_(c)yogore.mid", title: "March (Nutcracker) - Tchaikovsky", speed:1},
		{file: "Hotline_Bling_MIDI_UPDATED_2016.mid", title: "Hotline Bling", speed: 1}	
	];
	
	
	//Native object stuff
	var schema = 
	{
		'n-text': 
		{
			text: '',
			fontSize: 10,//roughly a meter tall
			width: 80,//in meters
			height: 1,//in meters
			horizontalAlign: 'middle',
			verticalAlign: 'middle'
		}
	}

	function configureMIDI()
	{
		//Some MIDI files spread the piano across multiple channels. Let's change the first 4.
		MIDI.programChange(4, MIDI.GM.byName["acoustic_grand_piano"].number);
		MIDI.programChange(3, MIDI.GM.byName["acoustic_grand_piano"].number);
		MIDI.programChange(2, MIDI.GM.byName["acoustic_grand_piano"].number);
		MIDI.programChange(1, MIDI.GM.byName["acoustic_grand_piano"].number);
	}

	function setupUser(user)
	{
		if (user)
		{
			userID = user.displayName + '-' + Math.random().toString(36).substr(2, 9);
		}
		else
		{
			userID = 'altspaceUser-' + Math.random().toString(36).substr(2, 9);
		}
		
		colorUser = Please.make_color
		({
			golden: false,
			saturation: 1,
			value: 1
		})[0];
		noteColorUserDown = new THREE.Color(colorUser);
	}

	function setupScale(enclosure) 
	{
		//Notice: The piano was built using the Medium SDK Room. The scale is based on that room's enclosure PPM.
		if (enclosure.innerDepth == 1)
		{
			scale = (enclosure.pixelsPerMeter / 285.714294) * 3;	
		}
		else
		{
			scale = (enclosure.pixelsPerMeter / 285.714294) * 3;
		}
		
		whiteDistance = (whiteDistance * scale) / 3;
		blackDistance = (blackDistance * scale) / 3;
		xPos = (xPos * scale) / 3;
		yPos = (79 * scale);
		zPos = (zPos * scale)  / 3;
		blackPosOffset = 1.5 * scale;
	}

	function initializeApp(connection, trackingSkeleton)
	{
		if (trackingSkeleton) {
			skeleton = trackingSkeleton;
			scene.add(skeleton);
		}

		console.log("Connected to Firebase!");
		instanceData = connection.instance.child('data');
		instanceUsers = connection.instance.child('users');
		
		instanceData.child('name').set(spaceName);
		
		console.log("Initalizing Piano....");
		initalizePiano();
	}
	
	function setupApp(connection)
	{
		var promises = [alt.getUser(), alt.getEnclosure()];
		Promise.all(promises).then(function (values) {
			var user = values.shift();
			setupUser(user);
					
			var enclosure = values.shift();
			setupScale(enclosure);

			loadMidi(function () {
				configureMIDI();
				if (mobile) 
				{
					initializeApp(connection);
				} 
				else
				{
					altspace.getThreeJSTrackingSkeleton().then(function (trackingSkeleton) {
						initializeApp(connection, trackingSkeleton);
					});
				}
			});
		});
	}

	function setupFirebase() 
	{

		if (altspace.inClient) 
		{
			alt.getSpace().then(function(space) 
			{
				spaceSID = space.sid;
				spaceName = space.name;
						
				console.log("Connecting to Firebase....");
				//Connect to Firebase
				var config = { appId: "Midi Piano", instanceId: spaceSID, authorId: "NorybiaK", baseRefUrl: "midi-piano.firebaseio.com"};
				alt.utilities.sync.connect(config).then(function (connection) 
				{
					if (!location.search) 
					{
						// There isn't a firebase instance id in the query params yet. Return immediately so that
						// the sync util can add the query param and reload the app
						return;
					}

					setupApp(connection);
				});
			});
		}
	}

	function loadMidi(callback) 
	{
		MIDI.loadPlugin
		({
			soundfontUrl: "assets/soundfont/",
			targetFormat: "ogg",
			instruments: "acoustic_grand_piano",
			onsuccess: callback
		});
	}

	//Start the connection to Firebase and fire the main initialization. 
	main.start = function(s, config)
	{
		scene = s || false;
		pianoPosition = config.position || {x: 0, y: 0, z: 0};
		pianoRotation = config.rotation || {x: 0, y: 0, z: 0};
		
		if (!scene)
		{
			console.log("MidiPiano must be passed a scene! Exiting...");
			return;	
		}

		setupFirebase();
	}
	
	function initalizePiano()
	{
		//Setup the keys!
		for (var i = 0; i < 7; ++i) 
		{
			var octave = i * 12;
			setKey(octave + 0,  'W', 'B');
			setKey(octave + 1,  'B', 'W');
			setKey(octave + 2,  'W', 'B');
			setKey(octave + 3,  'W', 'W');
			setKey(octave + 4,  'B', 'W');
			setKey(octave + 5,  'W', 'B');
			setKey(octave + 6,  'B', 'W');
			setKey(octave + 7,  'W', 'B');
			setKey(octave + 8,  'W', 'W');
			setKey(octave + 9,  'B', 'W');
			setKey(octave + 10, 'W', 'B');
			setKey(octave + 11, 'B', 'W');
		}
		//last 4 keys for total of 88
		setKey(84, 'W', 'B');
		setKey(85, 'B', 'W');
		setKey(86, 'W', 'B');
		setKey(87, 'W', 'W');

		//Adds MIDI listener and changes key color based on active notes
		MIDI.Player.addListener(function(data) 
		{
			var channel = data.channel; //MIDI channel (default is 0)
			var velocity = data.velocity;
			var delay = 0;
			var message = data.message; // 128 is noteOff, 144 is noteOn
			var note = data.note - 21; // the note
			
			//TODO: Some midi files break rotation
			if (data.message == 144)
			{
				if (velocity == 0)
				{
					//var t = new TWEEN.Tween(keyObjects[note].rotation).to({  x:  0}, 0.1 ).start();
					if (keyData[note] == 'B') 
					{
						keyObjects[note].material.color = noteBUpColor;
					}
					else
					{
						keyObjects[note].material.color = noteWUpColor;
					}	
				}
				else
				{
					//var t = new TWEEN.Tween(keyObjects[note].rotation).to({  x:  keyObjects[note].rotation.x + 15 * (Math.PI / 180)}, 0.1 ).start();
					keyObjects[note].material.color = noteDownColor;	
				}
			}
			else
			{
				//var t = new TWEEN.Tween(keyObjects[note].rotation).to({  x:  0}, 0.1 ).start();
				if (keyData[note] == 'B') 
				{
					keyObjects[note].material.color = noteBUpColor;
				}
				else
				{
					keyObjects[note].material.color = noteWUpColor;
				}
			}
			keyObjects[note].material.needsUpdate = true;
		});	
	
		UltimateLoader.load('assets/model/piano.obj', function(object)
		{
			piano = object;
			piano.scale.set(scale, scale , scale);

			pianoGroup.add(piano);
			pianoGroup.position.set(pianoPosition.x, pianoPosition.y, pianoPosition.z);
			
			pianoGroup.rotation.x = pianoPosition.x * ( Math.PI / 180 );
			pianoGroup.rotation.y = pianoPosition.y * ( Math.PI / 180 );
			pianoGroup.rotation.z = pianoPosition.z * ( Math.PI / 180 );
			
			scene.add(pianoGroup);
			
			//text,y, z, rot, size (default 14)
			var infoText1 = createText("Play me!", 0, 125, 67, -18, 50);
			piano.add(infoText1);
			var infoText2 = createText("MIDI Keyboard?", 0, 118, 69, -18, 50);
			piano.add(infoText2);
			var infoText3 = createText("Visit - norybiak.com/apps/piano -", 0, 114, 70, -18, 50);
			piano.add(infoText3);
					
			//Sides that contain the keys on piano model
			var materialCreator = new THREE.MTLLoader.MaterialCreator();
			materialCreator.crossOrigin = 'anonymous';
			var url1 = 'assets/textures/wood.jpg';
			var texture1 = materialCreator.loadTexture(url1);
			var material = new THREE.MeshBasicMaterial({ color: '#FFFFFF', map: texture1});
			
			var geometry = new THREE.BoxGeometry(7, 5, 30);
			var leftSide = new THREE.Mesh(geometry, material);
			leftSide.scale.set(1, 1, 1);
			
			leftSide.position.set(-75.9,79.5,83);
			piano.add(leftSide);
			
			var rightSide = new THREE.Mesh(geometry, material);
			rightSide.scale.set(1, 1, 1);
			
			rightSide.position.set(77.3,79.5,83);
			piano.add(rightSide);
			
			//create the controls
			setupControls();
			
			//Let's create the text!
			for (i = 0; i < songs.length; i++) 
			{
				songs[i].text = createText(songs[i].title, 0, 100, 80.5, 0, 50);
				piano.add(songs[i].text);
				songs[i].text.visible = false;
			}
			
			//Okay, we know the model is loaded now...so let's animate
			animate();
			
			//Had to move this here since the model wasn't loading before Firebase instance
			initalizeInstance();
			
			console.log("Piano initalized!");

			var loading = document.querySelector('.piano-loading');
			if (loading) 
			{
				loading.style.display = 'none';
			}
		});
	}
	
	//setup the individual piano keys
	function setKey(i, type, prevKey)
	{
		//W or B for type of keys - used for positioning
		if (type == 'W')
		{
			if (prevKey == 'W') { xPos += whiteDistance; } else { xPos += blackDistance; }
			
			if (!whiteKeyGeometry) 
			{
				whiteKeyGeometry = new THREE.BoxGeometry(2.68, 5.83, 17.5);
				whiteKeyGeometry.name = 'whiteKeyGeometry';
				// 1.5 / 2 gets edge of mesh.
				whiteKeyGeometry.translate( 0, 0, 8.75 );
			}

			var materialCreator = new THREE.MTLLoader.MaterialCreator();
			materialCreator.crossOrigin = 'anonymous';
			var url1 = 'assets/textures/keyShadow.png';
			var texture1 = materialCreator.loadTexture(url1);
			var material = new THREE.MeshBasicMaterial({color:'#FFFFFF', map: texture1});
			
			keyObjects[i] = new THREE.Mesh(whiteKeyGeometry, material);
			
			keyObjects[i].scale.set(scale, scale , scale);
			keyObjects[i].position.set(xPos,yPos,zPos);
		}
		else if (type == 'B')
		{
			xPos += blackDistance;
			
			if (!blackKeyGeometry) 
			{
				blackKeyGeometry = new THREE.BoxGeometry(1.52, 6.07, 12.83);
				blackKeyGeometry.name = 'blackKeyGeometry';
				blackKeyGeometry.translate( 0, 0,6.415 );
			}
			var material = new THREE.MeshBasicMaterial({color:'#000000'});
			
			keyObjects[i] = new THREE.Mesh(blackKeyGeometry, material);
			
			keyObjects[i].scale.set(scale, scale , scale);
			keyObjects[i].position.set(xPos,yPos+blackPosOffset,zPos);
		}
		
		keyData[i] = type;

		function playNote(i) 
		{
			return function () {
				if (!mute)
				{
					noteOn(i+21, 127);
					instanceUsers.child(userID).child('notes').child(i+21).set([Math.random(), 127]);
					
					setTimeout(function()
					{ 
						noteOff(i+21, 0);
						instanceUsers.child(userID).child('notes').child(i+21).set([0, 127]);
					}, 300);
				}
			}
		}
		
		if (!mobile) 
		{
			keyObjects[i].addBehavior(
				altspace.utilities.behaviors.JointCollisionEvents({joints: [['Index', 'Right', 3], ['Index', 'Left', 3]], jointCubeSize: 0.1})
			);
			
			keyObjects[i].addEventListener('jointcollisionenter', playNote(i));
		}

		//Keypress behavior for playable keys
		keyObjects[i].addEventListener('cursordown', playNote(i));
		
		pianoGroup.add(keyObjects[i]);
	}
	
	//setup the piano control buttons
	function setupControls()
	{
		var geometry;
		var materialCreator = new THREE.MTLLoader.MaterialCreator();
		materialCreator.crossOrigin = 'anonymous';
		var url1 = 'assets/textures/buttonShadow.png';
		var texture1 = materialCreator.loadTexture(url1);
		
		/*
		 *	Player Controls
		 */
		var buttonGeometry = new THREE.BoxGeometry(3, 3, 3);
		buttonGeometry.name = 'buttonGeometry';
		var playBtn = new THREE.Mesh(buttonGeometry, new THREE.MeshBasicMaterial({color:'#00ff00', map: texture1}));	
		playBtn.scale.set(1, 1 , 1);
		playBtn.position.set(0,5,0);
		playCtrlGroup.add(playBtn);
		
		//event listener to capture mouse
		playBtn.addEventListener('cursordown', function (event) 
		{
			if (!MIDI.Player.playing)
			{
				instanceData.update({startTime: Firebase.ServerValue.TIMESTAMP});
				instanceData.update({userStarted: userID});
				instanceData.update({playing: 1});
			}
		});
		
		var playText = createText("Play", 5, -1.5, 0.5, 0, 25);
		playText.x = 5;
		playBtn.add(playText);
		
		var nextBtn = new THREE.Mesh(buttonGeometry, new THREE.MeshBasicMaterial({color:'#f0ff00', map: texture1}));	
		nextBtn.scale.set(1, 1 , 1);
		nextBtn.position.set(0,0,0);
		playCtrlGroup.add(nextBtn);
	
		//event listener to capture mouse
		nextBtn.addEventListener('cursorup', function (event) 
		{
			currentSong++;
			instanceData.update({playing: 0, song: currentSong});
		});
		
		var nextText = createText("Next", 5, -1.5, 0.5, 0, 25);
		nextBtn.add(nextText);
		
		var stopBtn = new THREE.Mesh(buttonGeometry, new THREE.MeshBasicMaterial({color:'#FF0000', map: texture1}));	
		stopBtn.scale.set(1, 1 , 1);
		stopBtn.position.set(0,-5,0);
		playCtrlGroup.add(stopBtn);
		
		//event listener to capture mouse
		stopBtn.addEventListener('cursorup', function (event) 
		{
			instanceData.update({playing: 0});
		});
	
		var stopText = createText("Stop", 5, -1.5, 0.5, 0, 25);
		stopBtn.add(stopText);
		
		playCtrlGroup.position.set(-66, 95,80);
		piano.add(playCtrlGroup);
		
		/*
		 *	Volume Controls
		 */
		var muteBtn = new THREE.Mesh(buttonGeometry, new THREE.MeshBasicMaterial({color:'#f0ff00', map: texture1}));	
		muteBtn.scale.set(1, 1 , 1);
		muteBtn.position.set(-70,0,0);
		volCtrlGroup.add(muteBtn);
		
		var muteText = createText("Mute", 0, 3, 0.5, 0, 25);
		var unmuteText = createText("Unmute", 0, 3, 0.5, 0, 25);
		unmuteText.visible = false;
		muteBtn.add(muteText); 
		muteBtn.add(unmuteText);
		
		//event listener to capture mouse
		muteBtn.addEventListener('cursorup', function (event) 
		{
			muteText.visible = !muteText.visible;
			unmuteText.visible = !unmuteText.visible;
			mute = !mute;
			
			if (mute)
			{
				setVolume(0);
			}
			else
			{
				setVolume(volume);
			}
		});
		
		var volLine = new THREE.Group();
		volLine.position.set(-55,-1,0);
		volCtrlGroup.add(volLine);
		
		var volText = createText("Vol", 0, -4.5, 0.5, 0, 25);
		volLine.add(volText);
		
		
		var volBarGeometry = new THREE.BoxGeometry(0.8, 1, 2);
		//Volume bars
		//TODO: Fix scaling and positioning. Seems weird :/
		for (var i = 0; i < 5; i++)
		{
			ctrlObjects[i] = new THREE.Mesh(volBarGeometry, new THREE.MeshBasicMaterial({color:'#f0ff00', map: texture1}));
			ctrlObjects[i].scale.set(2,i*2+2,2);
			ctrlObjects[i].position.set(-4.2+(i*2), -0.5+(i+1), -0.5);
			
			volLine.add(ctrlObjects[i]);
			
			ctrlObjects[i].addEventListener('cursorup', function (event)
			{
				var flag = false;
				for (var j = 0; j < 5; j++)
				{
					if (event.target == ctrlObjects[j])
					{
						ctrlObjects[j].material.color = yellow;
						volume = j+1;
						setVolume(volume);
						flag = true;
					}
					else
					{
						if (flag)
						{
							ctrlObjects[j].material.color = gray;
						}
						else
						{
							ctrlObjects[j].material.color = yellow;
						}
					}
				}
			});
		}
	
		volCtrlGroup.position.set(120, 95,80);
		volCtrlGroup.scale.set(1,1,1);
		piano.add(volCtrlGroup);
	}
	
	//takes in string and splits it. Creates new mesh.
	function createText(str, x, y, z, rot, size)
	{
		var data = { text: str, fontSize: size };
		var textMesh = addNativeText(data);
		textMesh.position.set(x, y, z+1);
		textMesh.rotateX(rot * Math.PI / 180);
		
		return textMesh;
	}
	
	//takes in string and creates new TextGeometry. Returns.
	function createTextGeo(text, tsize)
	{
		var geo = new THREE.TextGeometry(text,
			{
				size: tsize,
				height: 1,
				curveSegments: 3
			}
		);
		
		geo.computeBoundingBox();
		geo.computeVertexNormals();
	
		return geo;
	}

	//Visibility toggle
	function visibility(arr, bool)
	{
		arr.visible = bool;
	}
		
	//Instance initialization
	function initalizeInstance()
	{
		//If the instance is created for the first time then set the data to 0
		instanceData.once("value", function(snapshot) 
		{
			var data = snapshot.exists();
			
			if(!data)
				instanceData.set({playing: 0, song: 0});
		});
		
		instanceUsers.child(userID).child('settings').set({color: colorUser});
	
		//Get all current users and continue to check for any new user that joins.
		//This also sets listeners for when remote user midi is played.
		instanceUsers.on('child_added', function (childSnapshot, prevChildkey) 
		{
			var user = childSnapshot.key();
			var userRef = instanceUsers.child(user);
			
			//We don't want to capture the local user's midi data back to themselves.
			if (user != userID) 
			{
				console.log("New user joined: " + user);
				
				//Get the remote user color
				userRef.child('settings').child('color').once("value", function(data) 
				{
					var color = data.val();
					if (!color)
						color = Please.make_color
						({
							golden: false,
							saturation: 1,
							value: 1
						})[0];
						
					users[user] = new THREE.Color(color);
					console.log("User " + user + "'s color is set to " + data.val());
				});
					
				//Get the remote user notes that are turned on and play it.
				userRef.child('notes').on('child_added', function (snapshot) 
				{
					var note = snapshot.key();
					var value = snapshot.val();
					
					userRef.child('notes').child(note).on('value', function (snapshot) 
					{
						var value = snapshot.val();
						if (value) 
						{
							var state = value[0];
							var velocity = value[1];
							
							//state is either 1 or 0 (on or off).
							if (state == 0)
							{
								noteOff(note, velocity);
							}
							else
							{
								noteOn(note, velocity, user);
							}
						}
					});
				});
			}
		});	
		
		instanceUsers.child(userID).onDisconnect().remove();
		instanceUsers.on('child_removed', function (childSnapshot) 
		{
			var user = childSnapshot.key();
			var userRef = instanceUsers.child(user);
			
			userRef.child('on').off('value');
			userRef.child('off').off('value');
			
			delete users[user];
			
			console.log("User " + childSnapshot.key() + " has left.");
		});
		
		var playing = instanceData.child('playing');
		var song = instanceData.child('song');
		var currentTime = instanceData.child('currentTime');

		//Gets song change
		song.on('value', function (snapshot) 
		{
			var value = snapshot.val();
			
			if (value > songs.length-1)
			{
				currentSong = 0;
			}
			else
			{
				currentSong = value;
			}
			
			if (loadingFirstTime)
			{
				MIDI.Player.timeWarp = songs[currentSong].speed;
				MIDI.Player.loadFile("assets/songs/" + songs[currentSong].file, function ()
				{
					console.log(songs[currentSong].title + " " + " loaded!");
					loadFirstTime();
					loadingFirstTime = false;
				});
			}
			else
			{
				MIDI.Player.timeWarp = songs[currentSong].speed;
				MIDI.Player.loadFile("assets/songs/" + songs[currentSong].file, function ()
				{
					console.log(songs[currentSong].title + " " + " loaded!");
				});
			}	
			
			//set previous text to invis
			visibility(songs[value-1].text, false);

			//set new text to vis
			visibility(songs[currentSong].text, true);
			console.log("current song:" + currentSong);
		});
		
		//Note: setPlayinOn is a bit hackish, but if playing is set to 1,
		//we need to know if the song is loaded first before trying to play it!
		
		//Gets start/stop
		function loadFirstTime()
		{
			playing.on('value', function (snapshot) 
			{
				var value = snapshot.val();

				if (value == 1)
				{
					instanceUsers.child(userID).child('control').update({joinTime: Firebase.ServerValue.TIMESTAMP});
					instanceData.child('startTime').once('value', function (snapshot)
					{
						var startTime = snapshot.val();
						instanceUsers.child(userID).child('control').child('joinTime').once('value', function (snapshot1)
						{
							var joinTime = snapshot1.val();
							var time = joinTime - startTime;
							
							//This if should rarely be true when Piano is actively being used.
							//It's purpose is for when the Piano was left playing.
							//A user who joins the room will reset the Piano if the time expired beyond the song time.
							if (time > MIDI.Player.endTime)
							{
								instanceData.update({playing: 0});
							}
							else
							{
								MIDI.Player.currentTime = time;
								MIDI.Player.start();
							}
						});
					});
				}
				else 
				{
					MIDI.Player.stop();
					instanceData.update({startTime: 0});
				}
			});	
		}
		console.log("Firebase functions initalized!");
	}

	//Play the note
	function noteOn(note, velocity, user) 
	{
		user = user || false;
		
		if(!mute)
			MIDI.noteOn(0, note, velocity);
			
		if (keyObjects[note-21].rotation.x == 0)
		{
			if (keyData[note-21] == 'B') 
			{
				var t = new TWEEN.Tween(keyObjects[note-21].rotation).to({  x:  keyObjects[note-21].rotation.x + Math.PI * .02}, 0.1 ).start();
			}
			else
			{
				var t = new TWEEN.Tween(keyObjects[note-21].rotation).to({  x:  keyObjects[note-21].rotation.x + Math.PI * .04}, 0.1 ).start();
			}
		}
		if (user)
		{
			keyObjects[note-21].material.color = users[user];
		}
		else
		{
			keyObjects[note-21].material.color = noteColorUserDown;
		}
						
		//console.log("Note ON: " + note + ", " + velocity);
	}

	//Stop playing the note
	function noteOff(note, velocity, delay) 
	{
		if(!mute)
			MIDI.noteOff(0, note, velocity);
		
		var t = new TWEEN.Tween(keyObjects[note-21].rotation).to({  x:  0}, 0.1 ).start();
		if (keyData[note-21] == 'B')
		{
			keyObjects[note-21].material.color = noteBUpColor;
		}
		else
		{
			keyObjects[note-21].material.color = noteWUpColor;
		}
		
		//console.log("Note OFF: " + note + ", " + velocity);
	}
	
	function setVolume(val)
	{
		var vol = (25.4 * val);

		MIDI.setVolume(0, vol);
		
		console.log(val + ' ' + vol);
	}

	main.update = function() 
	{
		TWEEN.update();

		// We only use the behavior system for joint collision events, so don't bother on mobile
		if (!mobile) {
			scene.updateAllBehaviors();
		}
	}
	
	function addNativeText(theData)
	{
		var mesh = addNativeObject('n-text');
		updateNativeObject(mesh, 'n-text', theData);
		
		return mesh;
	}

	
	var placeholderGeometry = new THREE.BoxGeometry(0.001, 0.001, 0.001);
	var placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
	placeholderMaterial.visible = false;
	function addNativeObject(type)
	{
		
		var mesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);	
		
		scene.add(mesh);
		
		altspace.addNativeComponent(mesh, type);

		return mesh;
	}
	
	function updateNativeObject(mesh, type, data)
	{
		var theSchema = schema['n-text'];
		for (var s in data)
		{
			theSchema[s] = data[s];
		}
		
		altspace.updateNativeComponent(mesh, type, theSchema);
	}
	
	if (window.AFRAME)
	{
		AFRAME.registerComponent('midi-piano', 
		 {
			schema: 
			{ 
				position: { type: 'vec3', default: '0 0 0'},
				rotation: { type: 'vec3', default: '0 0 0'}
			},
			init: function () {  main.start(this.el.object3D, this.data); },
			tick: function () { if (isInitilized) main.update(); }
		 });	
	}
	
})(MidiPiano, altspace);

//https://github.com/davidchambers/Base64.js

;(function () {
  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next input index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      input.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = input.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    input = input.replace(/=+$/, '')
    if (input.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = input.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());
/**
 * @license -------------------------------------------------------------------
 *   module: Base64Binary
 *      src: http://blog.danguer.com/2011/10/24/base64-binary-decoding-in-javascript/
 *  license: Simplified BSD License
 * -------------------------------------------------------------------
 * Copyright 2011, Daniel Guerrero. All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     - Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     - Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL DANIEL GUERRERO BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var Base64Binary = {
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	/* will return a  Uint8Array type */
	decodeArrayBuffer: function(input) {
		var bytes = Math.ceil( (3*input.length) / 4.0);
		var ab = new ArrayBuffer(bytes);
		this.decode(input, ab);

		return ab;
	},

	decode: function(input, arrayBuffer) {
		//get last chars to see if are valid
		var lkey1 = this._keyStr.indexOf(input.charAt(input.length-1));		 
		var lkey2 = this._keyStr.indexOf(input.charAt(input.length-1));		 

		var bytes = Math.ceil( (3*input.length) / 4.0);
		if (lkey1 == 64) bytes--; //padding chars, so skip
		if (lkey2 == 64) bytes--; //padding chars, so skip

		var uarray;
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
		var j = 0;

		if (arrayBuffer)
			uarray = new Uint8Array(arrayBuffer);
		else
			uarray = new Uint8Array(bytes);

		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

		for (i=0; i<bytes; i+=3) {	
			//get the 3 octects in 4 ascii chars
			enc1 = this._keyStr.indexOf(input.charAt(j++));
			enc2 = this._keyStr.indexOf(input.charAt(j++));
			enc3 = this._keyStr.indexOf(input.charAt(j++));
			enc4 = this._keyStr.indexOf(input.charAt(j++));

			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;

			uarray[i] = chr1;			
			if (enc3 != 64) uarray[i+1] = chr2;
			if (enc4 != 64) uarray[i+2] = chr3;
		}

		return uarray;	
	}
};
/*
	----------------------------------------------------------
	util/Request : 0.1.1 : 2015-03-26
	----------------------------------------------------------
	util.request({
		url: './dir/something.extension',
		data: 'test!',
		format: 'text', // text | xml | json | binary
		responseType: 'text', // arraybuffer | blob | document | json | text
		headers: {},
		withCredentials: true, // true | false
		///
		onerror: function(evt, percent) {
			console.log(evt);
		},
		onsuccess: function(evt, responseText) {
			console.log(responseText);
		},
		onprogress: function(evt, percent) {
			percent = Math.round(percent * 100);
			loader.create('thread', 'loading... ', percent);
		}
	});
*/

if (typeof MIDI === 'undefined') MIDI = {};

(function(root) {

	var util = root.util || (root.util = {});

	util.request = function(opts, onsuccess, onerror, onprogress) { 'use strict';
		if (typeof opts === 'string') opts = {url: opts};
		///
		var data = opts.data;
		var url = opts.url;
		var method = opts.method || (opts.data ? 'POST' : 'GET');
		var format = opts.format;
		var headers = opts.headers;
		var responseType = opts.responseType;
		var withCredentials = opts.withCredentials || false;
		///
		var onsuccess = onsuccess || opts.onsuccess;
		var onerror = onerror || opts.onerror;
		var onprogress = onprogress || opts.onprogress;
		///
		if (typeof NodeFS !== 'undefined' && root.loc.isLocalUrl(url)) {
			NodeFS.readFile(url, 'utf8', function(err, res) {
				if (err) {
					onerror && onerror(err);
				} else {
					onsuccess && onsuccess({responseText: res});
				}
			});
			return;
		}
		///
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		///
		if (headers) {
			for (var type in headers) {
				xhr.setRequestHeader(type, headers[type]);
			}
		} else if (data) { // set the default headers for POST
			xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		}
		if (format === 'binary') { //- default to responseType="blob" when supported
			if (xhr.overrideMimeType) {
				xhr.overrideMimeType('text/plain; charset=x-user-defined');
			}
		}
		if (responseType) {
			xhr.responseType = responseType;
		}
		if (withCredentials) {
			xhr.withCredentials = 'true';
		}
		if (onerror && 'onerror' in xhr) {
			xhr.onerror = onerror;
		}
		if (onprogress && xhr.upload && 'onprogress' in xhr.upload) {
			if (data) {
				xhr.upload.onprogress = function(evt) {
					onprogress.call(xhr, evt, event.loaded / event.total);
				};
			} else {
				xhr.addEventListener('progress', function(evt) {
					var totalBytes = 0;
					if (evt.lengthComputable) {
						totalBytes = evt.total;
					} else if (xhr.totalBytes) {
						totalBytes = xhr.totalBytes;
					} else {
						var rawBytes = parseInt(xhr.getResponseHeader('Content-Length-Raw'));
						if (isFinite(rawBytes)) {
							xhr.totalBytes = totalBytes = rawBytes;
						} else {
							return;
						}
					}
					onprogress.call(xhr, evt, evt.loaded / totalBytes);
				});
			}
		}
		///
		xhr.onreadystatechange = function(evt) {
			if (xhr.readyState === 4) { // The request is complete
				if (xhr.status === 200 || // Response OK
					xhr.status === 304 || // Not Modified
					xhr.status === 308 || // Permanent Redirect
					xhr.status === 0 && root.client.cordova // Cordova quirk
				) {
					if (onsuccess) {
						var res;
						if (format === 'xml') {
							res = evt.target.responseXML;
						} else if (format === 'text') {
							res = evt.target.responseText;
						} else if (format === 'json') {
							try {
								res = JSON.parse(evt.target.response);
							} catch(err) {
								onerror && onerror.call(xhr, evt);
							}
						}
						///
						onsuccess.call(xhr, evt, res);
					}
				} else {
					onerror && onerror.call(xhr, evt);
				}
			}
		};
		xhr.send(data);
		return xhr;
	};

	/// NodeJS
	if (typeof module !== 'undefined' && module.exports) {
		var NodeFS = require('fs');
		XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
		module.exports = root.util.request;
	}

})(MIDI);
/*
	-----------------------------------------------------------
	dom.loadScript.js : 0.1.4 : 2014/02/12 : http://mudcu.be
	-----------------------------------------------------------
	Copyright 2011-2014 Mudcube. All rights reserved.
	-----------------------------------------------------------
	/// No verification
	dom.loadScript.add("../js/jszip/jszip.js");
	/// Strict loading order and verification.
	dom.loadScript.add({
		strictOrder: true,
		urls: [
			{
				url: "../js/jszip/jszip.js",
				verify: "JSZip",
				onsuccess: function() {
					console.log(1)
				}
			},
			{ 
				url: "../inc/downloadify/js/swfobject.js",
				verify: "swfobject",
				onsuccess: function() {
					console.log(2)
				}
			}
		],
		onsuccess: function() {
			console.log(3)
		}
	});
	/// Just verification.
	dom.loadScript.add({
		url: "../js/jszip/jszip.js",
		verify: "JSZip",
		onsuccess: function() {
			console.log(1)
		}
	});
*/

if (typeof(dom) === "undefined") var dom = {};

(function() { "use strict";

dom.loadScript = function() {
	this.loaded = {};
	this.loading = {};
	return this;
};

dom.loadScript.prototype.add = function(config) {
	var that = this;
	if (typeof(config) === "string") {
		config = { url: config };
	}
	var urls = config.urls;
	if (typeof(urls) === "undefined") {
		urls = [{ 
			url: config.url, 
			verify: config.verify
		}];
	}
	/// adding the elements to the head
	var doc = document.getElementsByTagName("head")[0];
	/// 
	var testElement = function(element, test) {
		if (that.loaded[element.url]) return;
		if (test && globalExists(test) === false) return;
		that.loaded[element.url] = true;
		//
		if (that.loading[element.url]) that.loading[element.url]();
		delete that.loading[element.url];
		//
		if (element.onsuccess) element.onsuccess();
		if (typeof(getNext) !== "undefined") getNext();
	};
	///
	var hasError = false;
	var batchTest = [];
	var addElement = function(element) {
		if (typeof(element) === "string") {
			element = {
				url: element,
				verify: config.verify
			};
		}
		if (/([\w\d.\[\]\'\"])$/.test(element.verify)) { // check whether its a variable reference
			var verify = element.test = element.verify;
			if (typeof(verify) === "object") {
				for (var n = 0; n < verify.length; n ++) {
					batchTest.push(verify[n]);
				}			
			} else {
				batchTest.push(verify);
			}
		}
		if (that.loaded[element.url]) return;
		var script = document.createElement("script");
		script.onreadystatechange = function() {
			if (this.readyState !== "loaded" && this.readyState !== "complete") return;
			testElement(element);
		};
		script.onload = function() {
			testElement(element);
		};
		script.onerror = function() {
			hasError = true;
			delete that.loading[element.url];
			if (typeof(element.test) === "object") {
				for (var key in element.test) {
					removeTest(element.test[key]);
				}			
			} else {
				removeTest(element.test);
			}
		};
		script.setAttribute("type", "text/javascript");
		script.setAttribute("src", element.url);
		doc.appendChild(script);
		that.loading[element.url] = function() {};
	};
	/// checking to see whether everything loaded properly
	var removeTest = function(test) {
		var ret = [];
		for (var n = 0; n < batchTest.length; n ++) {
			if (batchTest[n] === test) continue;
			ret.push(batchTest[n]);
		}
		batchTest = ret;
	};
	var onLoad = function(element) {
		if (element) {
			testElement(element, element.test);
		} else {
			for (var n = 0; n < urls.length; n ++) {
				testElement(urls[n], urls[n].test);
			}
		}
		var istrue = true;
		for (var n = 0; n < batchTest.length; n ++) {
			if (globalExists(batchTest[n]) === false) {
				istrue = false;
			}
		}
		if (!config.strictOrder && istrue) { // finished loading all the requested scripts
			if (hasError) {
				if (config.error) {
					config.error();
				}
			} else if (config.onsuccess) {
				config.onsuccess();
			}
		} else { // keep calling back the function
			setTimeout(function() { //- should get slower over time?
				onLoad(element);
			}, 10);
		}
	};
	/// loading methods;  strict ordering or loose ordering
	if (config.strictOrder) {
		var ID = -1;
		var getNext = function() {
			ID ++;
			if (!urls[ID]) { // all elements are loaded
				if (hasError) {
					if (config.error) {
						config.error();
					}
				} else if (config.onsuccess) {
					config.onsuccess();
				}
			} else { // loading new script
				var element = urls[ID];
				var url = element.url;
				if (that.loading[url]) { // already loading from another call (attach to event)
					that.loading[url] = function() {
						if (element.onsuccess) element.onsuccess();
						getNext();
					}
				} else if (!that.loaded[url]) { // create script element
					addElement(element);
					onLoad(element);
				} else { // it's already been successfully loaded
					getNext();
				}
			}
		};
		getNext();
	} else { // loose ordering
		for (var ID = 0; ID < urls.length; ID ++) {
			addElement(urls[ID]);
			onLoad(urls[ID]);
		}
	}
};

dom.loadScript = new dom.loadScript();

var globalExists = function(path, root) {
	try {
		path = path.split('"').join('').split("'").join('').split(']').join('').split('[').join('.');
		var parts = path.split(".");
		var length = parts.length;
		var object = root || window;
		for (var n = 0; n < length; n ++) {
			var key = parts[n];
			if (object[key] == null) {
				return false;
			} else { //
				object = object[key];
			}
		}
		return true;
	} catch(e) {
		return false;
	}
};

})();

/// For NodeJS
if (typeof (module) !== "undefined" && module.exports) {
	module.exports = dom.loadScript;
}
/* Wrapper for accessing strings through sequential reads */
function Stream(str) {
	var position = 0;
	
	function read(length) {
		var result = str.substr(position, length);
		position += length;
		return result;
	}
	
	/* read a big-endian 32-bit integer */
	function readInt32() {
		var result = (
			(str.charCodeAt(position) << 24)
			+ (str.charCodeAt(position + 1) << 16)
			+ (str.charCodeAt(position + 2) << 8)
			+ str.charCodeAt(position + 3));
		position += 4;
		return result;
	}

	/* read a big-endian 16-bit integer */
	function readInt16() {
		var result = (
			(str.charCodeAt(position) << 8)
			+ str.charCodeAt(position + 1));
		position += 2;
		return result;
	}
	
	/* read an 8-bit integer */
	function readInt8(signed) {
		var result = str.charCodeAt(position);
		if (signed && result > 127) result -= 256;
		position += 1;
		return result;
	}
	
	function eof() {
		return position >= str.length;
	}
	
	/* read a MIDI-style variable-length integer
		(big-endian value in groups of 7 bits,
		with top bit set to signify that another byte follows)
	*/
	function readVarInt() {
		var result = 0;
		while (true) {
			var b = readInt8();
			if (b & 0x80) {
				result += (b & 0x7f);
				result <<= 7;
			} else {
				/* b is the last byte */
				return result + b;
			}
		}
	}
	
	return {
		'eof': eof,
		'read': read,
		'readInt32': readInt32,
		'readInt16': readInt16,
		'readInt8': readInt8,
		'readVarInt': readVarInt
	}
}
/*
class to parse the .mid file format
(depends on stream.js)
*/
function MidiFile(data) {
	function readChunk(stream) {
		var id = stream.read(4);
		var length = stream.readInt32();
		return {
			'id': id,
			'length': length,
			'data': stream.read(length)
		};
	}
	
	var lastEventTypeByte;
	
	function readEvent(stream) {
		var event = {};
		event.deltaTime = stream.readVarInt();
		var eventTypeByte = stream.readInt8();
		if ((eventTypeByte & 0xf0) == 0xf0) {
			/* system / meta event */
			if (eventTypeByte == 0xff) {
				/* meta event */
				event.type = 'meta';
				var subtypeByte = stream.readInt8();
				var length = stream.readVarInt();
				switch(subtypeByte) {
					case 0x00:
						event.subtype = 'sequenceNumber';
						if (length != 2) throw "Expected length for sequenceNumber event is 2, got " + length;
						event.number = stream.readInt16();
						return event;
					case 0x01:
						event.subtype = 'text';
						event.text = stream.read(length);
						return event;
					case 0x02:
						event.subtype = 'copyrightNotice';
						event.text = stream.read(length);
						return event;
					case 0x03:
						event.subtype = 'trackName';
						event.text = stream.read(length);
						return event;
					case 0x04:
						event.subtype = 'instrumentName';
						event.text = stream.read(length);
						return event;
					case 0x05:
						event.subtype = 'lyrics';
						event.text = stream.read(length);
						return event;
					case 0x06:
						event.subtype = 'marker';
						event.text = stream.read(length);
						return event;
					case 0x07:
						event.subtype = 'cuePoint';
						event.text = stream.read(length);
						return event;
					case 0x20:
						event.subtype = 'midiChannelPrefix';
						if (length != 1) throw "Expected length for midiChannelPrefix event is 1, got " + length;
						event.channel = stream.readInt8();
						return event;
					case 0x2f:
						event.subtype = 'endOfTrack';
						if (length != 0) throw "Expected length for endOfTrack event is 0, got " + length;
						return event;
					case 0x51:
						event.subtype = 'setTempo';
						if (length != 3) throw "Expected length for setTempo event is 3, got " + length;
						event.microsecondsPerBeat = (
							(stream.readInt8() << 16)
							+ (stream.readInt8() << 8)
							+ stream.readInt8()
						)
						return event;
					case 0x54:
						event.subtype = 'smpteOffset';
						if (length != 5) throw "Expected length for smpteOffset event is 5, got " + length;
						var hourByte = stream.readInt8();
						event.frameRate = {
							0x00: 24, 0x20: 25, 0x40: 29, 0x60: 30
						}[hourByte & 0x60];
						event.hour = hourByte & 0x1f;
						event.min = stream.readInt8();
						event.sec = stream.readInt8();
						event.frame = stream.readInt8();
						event.subframe = stream.readInt8();
						return event;
					case 0x58:
						event.subtype = 'timeSignature';
						if (length != 4) throw "Expected length for timeSignature event is 4, got " + length;
						event.numerator = stream.readInt8();
						event.denominator = Math.pow(2, stream.readInt8());
						event.metronome = stream.readInt8();
						event.thirtyseconds = stream.readInt8();
						return event;
					case 0x59:
						event.subtype = 'keySignature';
						if (length != 2) throw "Expected length for keySignature event is 2, got " + length;
						event.key = stream.readInt8(true);
						event.scale = stream.readInt8();
						return event;
					case 0x7f:
						event.subtype = 'sequencerSpecific';
						event.data = stream.read(length);
						return event;
					default:
						// console.log("Unrecognised meta event subtype: " + subtypeByte);
						event.subtype = 'unknown'
						event.data = stream.read(length);
						return event;
				}
				event.data = stream.read(length);
				return event;
			} else if (eventTypeByte == 0xf0) {
				event.type = 'sysEx';
				var length = stream.readVarInt();
				event.data = stream.read(length);
				return event;
			} else if (eventTypeByte == 0xf7) {
				event.type = 'dividedSysEx';
				var length = stream.readVarInt();
				event.data = stream.read(length);
				return event;
			} else {
				throw "Unrecognised MIDI event type byte: " + eventTypeByte;
			}
		} else {
			/* channel event */
			var param1;
			if ((eventTypeByte & 0x80) == 0) {
				/* running status - reuse lastEventTypeByte as the event type.
					eventTypeByte is actually the first parameter
				*/
				param1 = eventTypeByte;
				eventTypeByte = lastEventTypeByte;
			} else {
				param1 = stream.readInt8();
				lastEventTypeByte = eventTypeByte;
			}
			var eventType = eventTypeByte >> 4;
			event.channel = eventTypeByte & 0x0f;
			event.type = 'channel';
			switch (eventType) {
				case 0x08:
					event.subtype = 'noteOff';
					event.noteNumber = param1;
					event.velocity = stream.readInt8();
					return event;
				case 0x09:
					event.noteNumber = param1;
					event.velocity = stream.readInt8();
					if (event.velocity == 0) {
						event.subtype = 'noteOff';
					} else {
						event.subtype = 'noteOn';
					}
					return event;
				case 0x0a:
					event.subtype = 'noteAftertouch';
					event.noteNumber = param1;
					event.amount = stream.readInt8();
					return event;
				case 0x0b:
					event.subtype = 'controller';
					event.controllerType = param1;
					event.value = stream.readInt8();
					return event;
				case 0x0c:
					event.subtype = 'programChange';
					event.programNumber = param1;
					return event;
				case 0x0d:
					event.subtype = 'channelAftertouch';
					event.amount = param1;
					return event;
				case 0x0e:
					event.subtype = 'pitchBend';
					event.value = param1 + (stream.readInt8() << 7);
					return event;
				default:
					throw "Unrecognised MIDI event type: " + eventType
					/* 
					console.log("Unrecognised MIDI event type: " + eventType);
					stream.readInt8();
					event.subtype = 'unknown';
					return event;
					*/
			}
		}
	}
	
	stream = Stream(data);
	var headerChunk = readChunk(stream);
	if (headerChunk.id != 'MThd' || headerChunk.length != 6) {
		throw "Bad .mid file - header not found";
	}
	var headerStream = Stream(headerChunk.data);
	var formatType = headerStream.readInt16();
	var trackCount = headerStream.readInt16();
	var timeDivision = headerStream.readInt16();
	
	if (timeDivision & 0x8000) {
		throw "Expressing time division in SMTPE frames is not supported yet"
	} else {
		ticksPerBeat = timeDivision;
	}
	
	var header = {
		'formatType': formatType,
		'trackCount': trackCount,
		'ticksPerBeat': ticksPerBeat
	}
	var tracks = [];
	for (var i = 0; i < header.trackCount; i++) {
		tracks[i] = [];
		var trackChunk = readChunk(stream);
		if (trackChunk.id != 'MTrk') {
			throw "Unexpected chunk - expected MTrk, got "+ trackChunk.id;
		}
		var trackStream = Stream(trackChunk.data);
		while (!trackStream.eof()) {
			var event = readEvent(trackStream);
			tracks[i].push(event);
			//console.log(event);
		}
	}
	
	return {
		'header': header,
		'tracks': tracks
	}
}
var clone = function (o) {
	if (typeof o != 'object') return (o);
	if (o == null) return (o);
	var ret = (typeof o.length == 'number') ? [] : {};
	for (var key in o) ret[key] = clone(o[key]);
	return ret;
};

function Replayer(midiFile, timeWarp, eventProcessor, bpm) {
	var trackStates = [];
	var beatsPerMinute = bpm ? bpm : 120;
	var bpmOverride = bpm ? true : false;

	var ticksPerBeat = midiFile.header.ticksPerBeat;
	
	for (var i = 0; i < midiFile.tracks.length; i++) {
		trackStates[i] = {
			'nextEventIndex': 0,
			'ticksToNextEvent': (
				midiFile.tracks[i].length ?
					midiFile.tracks[i][0].deltaTime :
					null
			)
		};
	}

	var nextEventInfo;
	var samplesToNextEvent = 0;
	
	function getNextEvent() {
		var ticksToNextEvent = null;
		var nextEventTrack = null;
		var nextEventIndex = null;
		
		for (var i = 0; i < trackStates.length; i++) {
			if (
				trackStates[i].ticksToNextEvent != null
				&& (ticksToNextEvent == null || trackStates[i].ticksToNextEvent < ticksToNextEvent)
			) {
				ticksToNextEvent = trackStates[i].ticksToNextEvent;
				nextEventTrack = i;
				nextEventIndex = trackStates[i].nextEventIndex;
			}
		}
		if (nextEventTrack != null) {
			/* consume event from that track */
			var nextEvent = midiFile.tracks[nextEventTrack][nextEventIndex];
			if (midiFile.tracks[nextEventTrack][nextEventIndex + 1]) {
				trackStates[nextEventTrack].ticksToNextEvent += midiFile.tracks[nextEventTrack][nextEventIndex + 1].deltaTime;
			} else {
				trackStates[nextEventTrack].ticksToNextEvent = null;
			}
			trackStates[nextEventTrack].nextEventIndex += 1;
			/* advance timings on all tracks by ticksToNextEvent */
			for (var i = 0; i < trackStates.length; i++) {
				if (trackStates[i].ticksToNextEvent != null) {
					trackStates[i].ticksToNextEvent -= ticksToNextEvent
				}
			}
			return {
				"ticksToEvent": ticksToNextEvent,
				"event": nextEvent,
				"track": nextEventTrack
			}
		} else {
			return null;
		}
	};
	//
	var midiEvent;
	var temporal = [];
	//
	function processEvents() {
		function processNext() {
		    if (!bpmOverride && midiEvent.event.type == "meta" && midiEvent.event.subtype == "setTempo" ) {
				// tempo change events can occur anywhere in the middle and affect events that follow
				beatsPerMinute = 60000000 / midiEvent.event.microsecondsPerBeat;
			}
			///
			var beatsToGenerate = 0;
			var secondsToGenerate = 0;
			if (midiEvent.ticksToEvent > 0) {
				beatsToGenerate = midiEvent.ticksToEvent / ticksPerBeat;
				secondsToGenerate = beatsToGenerate / (beatsPerMinute / 60);
			}
			///
			var time = (secondsToGenerate * 1000 * timeWarp) || 0;
			temporal.push([ midiEvent, time]);
			midiEvent = getNextEvent();
		};
		///
		if (midiEvent = getNextEvent()) {
			while(midiEvent) processNext(true);
		}
	};
	processEvents();
	return {
		"getData": function() {
			return clone(temporal);
		}
	};
};

/*
	----------------------------------------------------------
	MIDI.audioDetect : 0.3.2 : 2015-03-26
	----------------------------------------------------------
	https://github.com/mudcube/MIDI.js
	----------------------------------------------------------
	Probably, Maybe, No... Absolutely!
	Test to see what types of <audio> MIME types are playable by the browser.
	----------------------------------------------------------
*/

if (typeof MIDI === 'undefined') MIDI = {};

(function(root) { 'use strict';

	var supports = {}; // object of supported file types
	var pending = 0; // pending file types to process
	var canPlayThrough = function (src) { // check whether format plays through
		pending ++;
		var body = document.body;
		var audio = new Audio();
		var mime = src.split(';')[0];
		audio.id = 'audio';
		audio.setAttribute('preload', 'auto');
		audio.setAttribute('audiobuffer', true);
		audio.addEventListener('error', function() {
			body.removeChild(audio);
			supports[mime] = false;
			pending --;
		}, false);
		audio.addEventListener('canplaythrough', function() {
			body.removeChild(audio);
			supports[mime] = true;
			pending --;
		}, false);
		audio.src = 'data:' + src;
		body.appendChild(audio);
	};

	root.audioDetect = function(onsuccess) {
		/// detect jazz-midi plugin
		if (navigator.requestMIDIAccess) {
			var isNative = Function.prototype.toString.call(navigator.requestMIDIAccess).indexOf('[native code]');
			if (isNative) { // has native midiapi support
				supports['webmidi'] = true;
			} else { // check for jazz plugin midiapi support
				for (var n = 0; navigator.plugins.length > n; n ++) {
					var plugin = navigator.plugins[n];
					if (plugin.name.indexOf('Jazz-Plugin') >= 0) {
						supports['webmidi'] = true;
					}
				}
			}
		}

		/// check whether <audio> tag is supported
		if (typeof(Audio) === 'undefined') {
			return onsuccess({});
		} else {
			supports['audiotag'] = true;
		}

		/// check for webaudio api support
		if (window.AudioContext || window.webkitAudioContext) {
			supports['webaudio'] = true;
		}

		/// check whether canPlayType is supported
		var audio = new Audio();
		if (typeof(audio.canPlayType) === 'undefined') {
			return onsuccess(supports);
		}

		/// see what we can learn from the browser
		var vorbis = audio.canPlayType('audio/ogg; codecs="vorbis"');
		vorbis = (vorbis === 'probably' || vorbis === 'maybe');
		var mpeg = audio.canPlayType('audio/mpeg');
		mpeg = (mpeg === 'probably' || mpeg === 'maybe');
		// maybe nothing is supported
		if (!vorbis && !mpeg) {
			onsuccess(supports);
			return;
		}

		/// or maybe something is supported
		//if (vorbis) canPlayThrough('audio/ogg;base64,T2dnUwACAAAAAAAAAADqnjMlAAAAAOyyzPIBHgF2b3JiaXMAAAAAAUAfAABAHwAAQB8AAEAfAACZAU9nZ1MAAAAAAAAAAAAA6p4zJQEAAAANJGeqCj3//////////5ADdm9yYmlzLQAAAFhpcGguT3JnIGxpYlZvcmJpcyBJIDIwMTAxMTAxIChTY2hhdWZlbnVnZ2V0KQAAAAABBXZvcmJpcw9CQ1YBAAABAAxSFCElGVNKYwiVUlIpBR1jUFtHHWPUOUYhZBBTiEkZpXtPKpVYSsgRUlgpRR1TTFNJlVKWKUUdYxRTSCFT1jFloXMUS4ZJCSVsTa50FkvomWOWMUYdY85aSp1j1jFFHWNSUkmhcxg6ZiVkFDpGxehifDA6laJCKL7H3lLpLYWKW4q91xpT6y2EGEtpwQhhc+211dxKasUYY4wxxsXiUyiC0JBVAAABAABABAFCQ1YBAAoAAMJQDEVRgNCQVQBABgCAABRFcRTHcRxHkiTLAkJDVgEAQAAAAgAAKI7hKJIjSZJkWZZlWZameZaouaov+64u667t6roOhIasBACAAAAYRqF1TCqDEEPKQ4QUY9AzoxBDDEzGHGNONKQMMogzxZAyiFssLqgQBKEhKwKAKAAAwBjEGGIMOeekZFIi55iUTkoDnaPUUcoolRRLjBmlEluJMYLOUeooZZRCjKXFjFKJscRUAABAgAMAQICFUGjIigAgCgCAMAYphZRCjCnmFHOIMeUcgwwxxiBkzinoGJNOSuWck85JiRhjzjEHlXNOSuekctBJyaQTAAAQ4AAAEGAhFBqyIgCIEwAwSJKmWZomipamiaJniqrqiaKqWp5nmp5pqqpnmqpqqqrrmqrqypbnmaZnmqrqmaaqiqbquqaquq6nqrZsuqoum65q267s+rZru77uqapsm6or66bqyrrqyrbuurbtS56nqqKquq5nqq6ruq5uq65r25pqyq6purJtuq4tu7Js664s67pmqq5suqotm64s667s2rYqy7ovuq5uq7Ks+6os+75s67ru2rrwi65r66os674qy74x27bwy7ouHJMnqqqnqq7rmarrqq5r26rr2rqmmq5suq4tm6or26os67Yry7aumaosm64r26bryrIqy77vyrJui67r66Ys67oqy8Lu6roxzLat+6Lr6roqy7qvyrKuu7ru+7JuC7umqrpuyrKvm7Ks+7auC8us27oxuq7vq7It/KosC7+u+8Iy6z5jdF1fV21ZGFbZ9n3d95Vj1nVhWW1b+V1bZ7y+bgy7bvzKrQvLstq2scy6rSyvrxvDLux8W/iVmqratum6um7Ksq/Lui60dd1XRtf1fdW2fV+VZd+3hV9pG8OwjK6r+6os68Jry8ov67qw7MIvLKttK7+r68ow27qw3L6wLL/uC8uq277v6rrStXVluX2fsSu38QsAABhwAAAIMKEMFBqyIgCIEwBAEHIOKQahYgpCCKGkEEIqFWNSMuakZM5JKaWUFEpJrWJMSuaclMwxKaGUlkopqYRSWiqlxBRKaS2l1mJKqcVQSmulpNZKSa2llGJMrcUYMSYlc05K5pyUklJrJZXWMucoZQ5K6iCklEoqraTUYuacpA46Kx2E1EoqMZWUYgupxFZKaq2kFGMrMdXUWo4hpRhLSrGVlFptMdXWWqs1YkxK5pyUzDkqJaXWSiqtZc5J6iC01DkoqaTUYiopxco5SR2ElDLIqJSUWiupxBJSia20FGMpqcXUYq4pxRZDSS2WlFosqcTWYoy1tVRTJ6XFklKMJZUYW6y5ttZqDKXEVkqLsaSUW2sx1xZjjqGkFksrsZWUWmy15dhayzW1VGNKrdYWY40x5ZRrrT2n1mJNMdXaWqy51ZZbzLXnTkprpZQWS0oxttZijTHmHEppraQUWykpxtZara3FXEMpsZXSWiypxNhirLXFVmNqrcYWW62ltVprrb3GVlsurdXcYqw9tZRrrLXmWFNtBQAADDgAAASYUAYKDVkJAEQBAADGMMYYhEYpx5yT0ijlnHNSKucghJBS5hyEEFLKnINQSkuZcxBKSSmUklJqrYVSUmqttQIAAAocAAACbNCUWByg0JCVAEAqAIDBcTRNFFXVdX1fsSxRVFXXlW3jVyxNFFVVdm1b+DVRVFXXtW3bFn5NFFVVdmXZtoWiqrqybduybgvDqKqua9uybeuorqvbuq3bui9UXVmWbVu3dR3XtnXd9nVd+Bmzbeu2buu+8CMMR9/4IeTj+3RCCAAAT3AAACqwYXWEk6KxwEJDVgIAGQAAgDFKGYUYM0gxphhjTDHGmAAAgAEHAIAAE8pAoSErAoAoAADAOeecc84555xzzjnnnHPOOeecc44xxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY0wAwE6EA8BOhIVQaMhKACAcAABACCEpKaWUUkoRU85BSSmllFKqFIOMSkoppZRSpBR1lFJKKaWUIqWgpJJSSimllElJKaWUUkoppYw6SimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaVUSimllFJKKaWUUkoppRQAYPLgAACVYOMMK0lnhaPBhYasBAByAwAAhRiDEEJpraRUUkolVc5BKCWUlEpKKZWUUqqYgxBKKqmlklJKKbXSQSihlFBKKSWUUkooJYQQSgmhlFRCK6mEUkoHoYQSQimhhFRKKSWUzkEoIYUOQkmllNRCSB10VFIpIZVSSiklpZQ6CKGUklJLLZVSWkqpdBJSKamV1FJqqbWSUgmhpFZKSSWl0lpJJbUSSkklpZRSSymFVFJJJYSSUioltZZaSqm11lJIqZWUUkqppdRSSiWlkEpKqZSSUmollZRSaiGVlEpJKaTUSimlpFRCSamlUlpKLbWUSkmptFRSSaWUlEpJKaVSSksppRJKSqmllFpJKYWSUkoplZJSSyW1VEoKJaWUUkmptJRSSymVklIBAEAHDgAAAUZUWoidZlx5BI4oZJiAAgAAQABAgAkgMEBQMApBgDACAQAAAADAAAAfAABHARAR0ZzBAUKCwgJDg8MDAAAAAAAAAAAAAACAT2dnUwAEAAAAAAAAAADqnjMlAgAAADzQPmcBAQA=');
		//if (mpeg) canPlayThrough('audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');

		/// lets find out!
		var time = (new Date()).getTime(); 
		var interval = window.setInterval(function() {
			var now = (new Date()).getTime();
			var maxExecution = now - time > 5000;
			if (!pending || maxExecution) {
				window.clearInterval(interval);
				onsuccess(supports);
			}
		}, 1);
	};

})(MIDI);
/*
	----------------------------------------------------------
	GeneralMIDI
	----------------------------------------------------------
*/

(function(root) { 'use strict';

	root.GM = (function(arr) {
		var clean = function(name) {
			return name.replace(/[^a-z0-9 ]/gi, '').replace(/[ ]/g, '_').toLowerCase();
		};
		var res = {
			byName: { },
			byId: { },
			byCategory: { }
		};
		for (var key in arr) {
			var list = arr[key];
			for (var n = 0, length = list.length; n < length; n++) {
				var instrument = list[n];
				if (!instrument) continue;
				var num = parseInt(instrument.substr(0, instrument.indexOf(' ')), 10);
				instrument = instrument.replace(num + ' ', '');
				res.byId[--num] = 
				res.byName[clean(instrument)] = 
				res.byCategory[clean(key)] = {
					id: clean(instrument),
					instrument: instrument,
					number: num,
					category: key
				};
			}
		}
		return res;
	})({
		'Piano': ['1 Acoustic Grand Piano', '2 Bright Acoustic Piano', '3 Electric Grand Piano', '4 Honky-tonk Piano', '5 Electric Piano 1', '6 Electric Piano 2', '7 Harpsichord', '8 Clavinet'],
		'Chromatic Percussion': ['9 Celesta', '10 Glockenspiel', '11 Music Box', '12 Vibraphone', '13 Marimba', '14 Xylophone', '15 Tubular Bells', '16 Dulcimer'],
		'Organ': ['17 Drawbar Organ', '18 Percussive Organ', '19 Rock Organ', '20 Church Organ', '21 Reed Organ', '22 Accordion', '23 Harmonica', '24 Tango Accordion'],
		'Guitar': ['25 Acoustic Guitar (nylon)', '26 Acoustic Guitar (steel)', '27 Electric Guitar (jazz)', '28 Electric Guitar (clean)', '29 Electric Guitar (muted)', '30 Overdriven Guitar', '31 Distortion Guitar', '32 Guitar Harmonics'],
		'Bass': ['33 Acoustic Bass', '34 Electric Bass (finger)', '35 Electric Bass (pick)', '36 Fretless Bass', '37 Slap Bass 1', '38 Slap Bass 2', '39 Synth Bass 1', '40 Synth Bass 2'],
		'Strings': ['41 Violin', '42 Viola', '43 Cello', '44 Contrabass', '45 Tremolo Strings', '46 Pizzicato Strings', '47 Orchestral Harp', '48 Timpani'],
		'Ensemble': ['49 String Ensemble 1', '50 String Ensemble 2', '51 Synth Strings 1', '52 Synth Strings 2', '53 Choir Aahs', '54 Voice Oohs', '55 Synth Choir', '56 Orchestra Hit'],
		'Brass': ['57 Trumpet', '58 Trombone', '59 Tuba', '60 Muted Trumpet', '61 French Horn', '62 Brass Section', '63 Synth Brass 1', '64 Synth Brass 2'],
		'Reed': ['65 Soprano Sax', '66 Alto Sax', '67 Tenor Sax', '68 Baritone Sax', '69 Oboe', '70 English Horn', '71 Bassoon', '72 Clarinet'],
		'Pipe': ['73 Piccolo', '74 Flute', '75 Recorder', '76 Pan Flute', '77 Blown Bottle', '78 Shakuhachi', '79 Whistle', '80 Ocarina'],
		'Synth Lead': ['81 Lead 1 (square)', '82 Lead 2 (sawtooth)', '83 Lead 3 (calliope)', '84 Lead 4 (chiff)', '85 Lead 5 (charang)', '86 Lead 6 (voice)', '87 Lead 7 (fifths)', '88 Lead 8 (bass + lead)'],
		'Synth Pad': ['89 Pad 1 (new age)', '90 Pad 2 (warm)', '91 Pad 3 (polysynth)', '92 Pad 4 (choir)', '93 Pad 5 (bowed)', '94 Pad 6 (metallic)', '95 Pad 7 (halo)', '96 Pad 8 (sweep)'],
		'Synth Effects': ['97 FX 1 (rain)', '98 FX 2 (soundtrack)', '99 FX 3 (crystal)', '100 FX 4 (atmosphere)', '101 FX 5 (brightness)', '102 FX 6 (goblins)', '103 FX 7 (echoes)', '104 FX 8 (sci-fi)'],
		'Ethnic': ['105 Sitar', '106 Banjo', '107 Shamisen', '108 Koto', '109 Kalimba', '110 Bagpipe', '111 Fiddle', '112 Shanai'],
		'Percussive': ['113 Tinkle Bell', '114 Agogo', '115 Steel Drums', '116 Woodblock', '117 Taiko Drum', '118 Melodic Tom', '119 Synth Drum'],
		'Sound effects': ['120 Reverse Cymbal', '121 Guitar Fret Noise', '122 Breath Noise', '123 Seashore', '124 Bird Tweet', '125 Telephone Ring', '126 Helicopter', '127 Applause', '128 Gunshot']
	});

	/* get/setInstrument
	--------------------------------------------------- */
	root.getInstrument = function(channelId) {
		var channel = root.channels[channelId];
		return channel && channel.instrument;
	};

	root.setInstrument = function(channelId, program, delay) {
		var channel = root.channels[channelId];
		if (delay) {
			return setTimeout(function() {
				channel.instrument = program;
			}, delay);
		} else {
			channel.instrument = program;
		}
	};

	/* get/setMono
	--------------------------------------------------- */
	root.getMono = function(channelId) {
		var channel = root.channels[channelId];
		return channel && channel.mono;
	};

	root.setMono = function(channelId, truthy, delay) {
		var channel = root.channels[channelId];
		if (delay) {
			return setTimeout(function() {
				channel.mono = truthy;
			}, delay);
		} else {
			channel.mono = truthy;
		}
	};

	/* get/setOmni
	--------------------------------------------------- */
	root.getOmni = function(channelId) {
		var channel = root.channels[channelId];
		return channel && channel.omni;
	};

	root.setOmni = function(channelId, truthy) {
		var channel = root.channels[channelId];
		if (delay) {
			return setTimeout(function() {
				channel.omni = truthy;	
			}, delay);
		} else {
			channel.omni = truthy;
		}
	};

	/* get/setSolo
	--------------------------------------------------- */
	root.getSolo = function(channelId) {
		var channel = root.channels[channelId];
		return channel && channel.solo;
	};

	root.setSolo = function(channelId, truthy) {
		var channel = root.channels[channelId];
		if (delay) {
			return setTimeout(function() {
				channel.solo = truthy;	
			}, delay);
		} else {
			channel.solo = truthy;
		}
	};

	/* channels
	--------------------------------------------------- */
	root.channels = (function() { // 0 - 15 channels
		var channels = {};
		for (var i = 0; i < 16; i++) {
			channels[i] = { // default values
				instrument: i,
				pitchBend: 0,
				mute: false,
				mono: false,
				omni: false,
				solo: false
			};
		}
		return channels;
	})();

	/* note conversions
	--------------------------------------------------- */
	root.keyToNote = {}; // C8  == 108
	root.noteToKey = {}; // 108 ==  C8

	(function() {
		var A0 = 0x15; // first note
		var C8 = 0x6C; // last note
		var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
		for (var n = A0; n <= C8; n++) {
			var octave = (n - 12) / 12 >> 0;
			var name = number2key[n % 12] + octave;
			root.keyToNote[name] = n;
			root.noteToKey[n] = name;
		}
	})();

})(MIDI);
/*
	----------------------------------------------------------
	MIDI.Plugin : 0.3.4 : 2015-03-26
	----------------------------------------------------------
	https://github.com/mudcube/MIDI.js
	----------------------------------------------------------
	Inspired by javax.sound.midi (albeit a super simple version): 
		http://docs.oracle.com/javase/6/docs/api/javax/sound/midi/package-summary.html
	----------------------------------------------------------
	Technologies
	----------------------------------------------------------
		Web MIDI API - no native support yet (jazzplugin)
		Web Audio API - firefox 25+, chrome 10+, safari 6+, opera 15+
		HTML5 Audio Tag - ie 9+, firefox 3.5+, chrome 4+, safari 4+, opera 9.5+, ios 4+, android 2.3+
	----------------------------------------------------------
*/

if (typeof MIDI === 'undefined') MIDI = {};

MIDI.Soundfont = MIDI.Soundfont || {};
MIDI.Player = MIDI.Player || {};

(function(root) { 'use strict';

	root.DEBUG = true;
	root.USE_XHR = true;
	root.soundfontUrl = './soundfont/';

	/*
		MIDI.loadPlugin({
			onsuccess: function() { },
			onprogress: function(state, percent) { },
			targetFormat: 'mp3', // optionally can force to use MP3 (for instance on mobile networks)
			instrument: 'acoustic_grand_piano', // or 1 (default)
			instruments: [ 'acoustic_grand_piano', 'acoustic_guitar_nylon' ] // or multiple instruments
		});
	*/

	root.loadPlugin = function(opts) {
		if (typeof opts === 'function') {
			opts = {onsuccess: opts};
		}

		root.soundfontUrl = opts.soundfontUrl || root.soundfontUrl;

		/// Detect the best type of audio to use
		root.audioDetect(function(supports) {
			var hash = window.location.hash;
			var api = '';

			/// use the most appropriate plugin if not specified
			if (supports[opts.api]) {
				api = opts.api;
			} else if (supports[hash.substr(1)]) {
				api = hash.substr(1);
			} else if (window.AudioContext || window.webkitAudioContext) { // Chrome
				api = 'webaudio';
			} 
			
			console.log(api);

			if (connect[api]) {
				/// use audio/ogg when supported
				if (opts.targetFormat) {
					var audioFormat = opts.targetFormat;
				} else { // use best quality
					var audioFormat = supports['audio/ogg'] ? 'ogg' : 'mp3';
				}

				/// load the specified plugin
				root.__api = api;
				root.__audioFormat = audioFormat;
				root.supports = supports;
				root.loadResource(opts);
			}
		});
	};

	/*
		root.loadResource({
			onsuccess: function() { },
			onprogress: function(state, percent) { },
			instrument: 'banjo'
		})
	*/

	root.loadResource = function(opts) {
		var instruments = opts.instruments || opts.instrument || 'acoustic_grand_piano';
		///
		if (typeof instruments !== 'object') {
			if (instruments || instruments === 0) {
				instruments = [instruments];
			} else {
				instruments = [];
			}
		}
		/// convert numeric ids into strings
		for (var i = 0; i < instruments.length; i ++) {
			var instrument = instruments[i];
			if (instrument === +instrument) { // is numeric
				if (root.GM.byId[instrument]) {
					instruments[i] = root.GM.byId[instrument].id;
				}
			}
		}
		///
		opts.format = root.__audioFormat;
		opts.instruments = instruments;
		///
		connect[root.__api](opts);
	};

	var connect = {
		webaudio: function(opts) {
			// works awesome! safari, chrome and firefox support
			// http://caniuse.com/web-audio
			requestQueue(opts, 'WebAudio');
		}
	};

	var requestQueue = function(opts, context) {
		var audioFormat = opts.format;
		var instruments = opts.instruments;
		var onprogress = opts.onprogress;
		var onerror = opts.onerror;
		///
		var length = instruments.length;
		var pending = length;
		var waitForEnd = function() {
			if (!--pending) {
				onprogress && onprogress('load', 1.0);
				root[context].connect(opts);
			}
		};
		///
		for (var i = 0; i < length; i ++) {
			var instrumentId = instruments[i];
			if (MIDI.Soundfont[instrumentId]) { // already loaded
				waitForEnd();
			} else { // needs to be requested
				sendRequest(instruments[i], audioFormat, function(evt, progress) {
					var fileProgress = progress / length;
					var queueProgress = (length - pending) / length;
					onprogress && onprogress('load', fileProgress + queueProgress, instrumentId);
				}, function() {
					waitForEnd();
				}, onerror);
			}
		};
	};

	var sendRequest = function(instrumentId, audioFormat, onprogress, onsuccess, onerror) {
		var soundfontPath = root.soundfontUrl + instrumentId + '-' + audioFormat + '.js';
		if (root.USE_XHR) {
			root.util.request({
				url: soundfontPath,
				format: 'text',
				onerror: onerror,
				onprogress: onprogress,
				onsuccess: function(event, responseText) {
					var script = document.createElement('script');
					script.language = 'javascript';
					script.type = 'text/javascript';
					script.text = responseText;
					document.body.appendChild(script);
					///
					onsuccess();
				}
			});
		} else {
			dom.loadScript.add({
				url: soundfontPath,
				verify: 'MIDI.Soundfont["' + instrumentId + '"]',
				onerror: onerror,
				onsuccess: function() {
					onsuccess();
				}
			});
		}
	};

	root.setDefaultPlugin = function(midi) {
		for (var key in midi) {
			root[key] = midi[key];
		}
	};

})(MIDI);
/*
	----------------------------------------------------------
	MIDI.Player : 0.3.1 : 2015-03-26
	----------------------------------------------------------
	https://github.com/mudcube/MIDI.js
	----------------------------------------------------------
*/

if (typeof MIDI === 'undefined') MIDI = {};
if (typeof MIDI.Player === 'undefined') MIDI.Player = {};

(function() { 'use strict';

var midi = MIDI.Player;
midi.currentTime = 0;
midi.endTime = 0; 
midi.restart = 0; 
midi.playing = false;
midi.timeWarp = 1;
midi.startDelay = 0;
midi.BPM = 120;

midi.start =
midi.resume = function(onsuccess) {
    if (midi.currentTime < -1) {
    	midi.currentTime = -1;
    }
    startAudio(midi.currentTime, null, onsuccess);
};

midi.pause = function() {
	var tmp = midi.restart;
	stopAudio();
	midi.restart = tmp;
};

midi.stop = function() {
	stopAudio();
	midi.restart = 0;
	midi.currentTime = 0;
};

midi.addListener = function(onsuccess) {
	onMidiEvent = onsuccess;
};

midi.removeListener = function() {
	onMidiEvent = undefined;
};

midi.clearAnimation = function() {
	if (midi.animationFrameId)  {
		cancelAnimationFrame(midi.animationFrameId);
	}
};

midi.setAnimation = function(callback) {
	var currentTime = 0;
	var tOurTime = 0;
	var tTheirTime = 0;
	//
	midi.clearAnimation();
	///
	var frame = function() {
		midi.animationFrameId = requestAnimationFrame(frame);
		///
		if (midi.endTime === 0) {
			return;
		}
		if (midi.playing) {
			currentTime = (tTheirTime === midi.currentTime) ? tOurTime - Date.now() : 0;
			if (midi.currentTime === 0) {
				currentTime = 0;
			} else {
				currentTime = midi.currentTime - currentTime;
			}
			if (tTheirTime !== midi.currentTime) {
				tOurTime = Date.now();
				tTheirTime = midi.currentTime;
			}
		} else { // paused
			currentTime = midi.currentTime;
		}
		///
		var endTime = midi.endTime;
		var percent = currentTime / endTime;
		var total = currentTime / 1000;
		var minutes = total / 60;
		var seconds = total - (minutes * 60);
		var t1 = minutes * 60 + seconds;
		var t2 = (endTime / 1000);
		///
		if (t2 - t1 < -1.0) {
			return;
		} else {
			callback({
				now: t1,
				end: t2,
				events: noteRegistrar
			});
		}
	};
	///
	requestAnimationFrame(frame);
};

// helpers

midi.loadMidiFile = function(onsuccess, onprogress, onerror) {
	try {
		midi.replayer = new Replayer(MidiFile(midi.currentData), midi.timeWarp, null, midi.BPM);
		midi.data = midi.replayer.getData();
		midi.endTime = getLength();
		///
		MIDI.loadPlugin({
// 			instruments: midi.getFileInstruments(),
			onsuccess: onsuccess,
			onprogress: onprogress,
			onerror: onerror
		});
	} catch(event) {
		onerror && onerror(event);
	}
};

midi.loadFile = function(file, onsuccess, onprogress, onerror) {
	midi.stop();
	if (file.indexOf('base64,') !== -1) {
		var data = window.atob(file.split(',')[1]);
		midi.currentData = data;
		midi.loadMidiFile(onsuccess, onprogress, onerror);
	} else {
		var fetch = new XMLHttpRequest();
		fetch.open('GET', file);
		fetch.overrideMimeType('text/plain; charset=x-user-defined');
		fetch.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					var t = this.responseText || '';
					var ff = [];
					var mx = t.length;
					var scc = String.fromCharCode;
					for (var z = 0; z < mx; z++) {
						ff[z] = scc(t.charCodeAt(z) & 255);
					}
					///
					var data = ff.join('');
					midi.currentData = data;
					midi.loadMidiFile(onsuccess, onprogress, onerror);
				} else {
					onerror && onerror('Unable to load MIDI file');
				}
			}
		};
		fetch.send();
	}
};

midi.getFileInstruments = function() {
	var instruments = {};
	var programs = {};
	for (var n = 0; n < midi.data.length; n ++) {
		var event = midi.data[n][0].event;
		if (event.type !== 'channel') {
			continue;
		}
		var channel = event.channel;
		switch(event.subtype) {
			case 'controller':
//				console.log(event.channel, MIDI.defineControl[event.controllerType], event.value);
				break;
			case 'programChange':
				programs[channel] = event.programNumber;
				break;
			case 'noteOn':
				var program = programs[channel];
				var gm = MIDI.GM.byId[isFinite(program) ? program : channel];
				instruments[gm.id] = true;
				break;
		}
	}
	var ret = [];
	for (var key in instruments) {
		ret.push(key);
	}
	return ret;
};

// Playing the audio

var eventQueue = []; // hold events to be triggered
var queuedTime; // 
var startTime = 0; // to measure time elapse
var noteRegistrar = {}; // get event for requested note
var onMidiEvent = undefined; // listener
var scheduleTracking = function(channel, note, currentTime, offset, message, velocity, time) {
	return setTimeout(function() {
		var data = {
			channel: channel,
			note: note,
			now: currentTime,
			end: midi.endTime,
			message: message,
			velocity: velocity
		};
		//
		if (message === 128) {
			delete noteRegistrar[note];
		} else {
			noteRegistrar[note] = data;
		}
		if (onMidiEvent) {
			onMidiEvent(data);
		}
		midi.currentTime = currentTime;
		///
		eventQueue.shift();
		///
		if (eventQueue.length < 1000) {
			startAudio(queuedTime, true);
		} else if (midi.currentTime === queuedTime && queuedTime < midi.endTime) { // grab next sequence
			startAudio(queuedTime, true);
		}
	}, currentTime - offset);
};

var getContext = function() {
	if (MIDI.api === 'webaudio') {
		return MIDI.WebAudio.getContext();
	} else {
		midi.ctx = {currentTime: 0};
	}
	return midi.ctx;
};

var getLength = function() {
	var data =  midi.data;
	var length = data.length;
	var totalTime = 0.5;
	for (var n = 0; n < length; n++) {
		totalTime += data[n][1];
	}
	return totalTime;
};

var __now;
var getNow = function() {
    if (window.performance && window.performance.now) {
        return window.performance.now();
    } else {
		return Date.now();
	}
};

var startAudio = function(currentTime, fromCache, onsuccess) {
	if (!midi.replayer) {
		return;
	}
	if (!fromCache) {
		if (typeof currentTime === 'undefined') {
			currentTime = midi.restart;
		}
		///
		midi.playing && stopAudio();
		midi.playing = true;
		midi.data = midi.replayer.getData();
		midi.endTime = getLength();
	}
	///
	var note;
	var offset = 0;
	var messages = 0;
	var data = midi.data;
	var ctx = getContext();
	var length = data.length;
	//
	queuedTime = 0.5;
	///
	var interval = eventQueue[0] && eventQueue[0].interval || 0;
	var foffset = currentTime - midi.currentTime;
	///
	if (MIDI.api !== 'webaudio') { // set currentTime on ctx
		var now = getNow();
		__now = __now || now;
		ctx.currentTime = (now - __now) / 1000;
	}
	///
	startTime = ctx.currentTime;
	///
	for (var n = 0; n < length && messages < 100; n++) {
		var obj = data[n];
		if ((queuedTime += obj[1]) <= currentTime) {
			offset = queuedTime;
			continue;
		}
		///
		currentTime = queuedTime - offset;
		///
		var event = obj[0].event;
		if (event.type !== 'channel') {
			continue;
		}
		///
		var channelId = event.channel;
		var channel = MIDI.channels[channelId];
		var delay = ctx.currentTime + ((currentTime + foffset + midi.startDelay) / 1000);
		var queueTime = queuedTime - offset + midi.startDelay;
		switch (event.subtype) {
			case 'controller':
				MIDI.setController(channelId, event.controllerType, event.value, delay);
				break;
			case 'programChange':
				MIDI.programChange(channelId, event.programNumber, delay);
				break;
			case 'pitchBend':
				MIDI.pitchBend(channelId, event.value, delay);
				break;
			case 'noteOn':
				if (channel.mute) break;
				note = event.noteNumber - (midi.MIDIOffset || 0);
				eventQueue.push({
				    event: event,
				    time: queueTime,
				    source: MIDI.noteOn(channelId, event.noteNumber, event.velocity, delay),
				    interval: scheduleTracking(channelId, note, queuedTime + midi.startDelay, offset - foffset, 144, event.velocity)
				});
				messages++;
				break;
			case 'noteOff':
				if (channel.mute) break;
				note = event.noteNumber - (midi.MIDIOffset || 0);
				eventQueue.push({
				    event: event,
				    time: queueTime,
				    source: MIDI.noteOff(channelId, event.noteNumber, delay),
				    interval: scheduleTracking(channelId, note, queuedTime, offset - foffset, 128, 0)
				});
				break;
			default:
				break;
		}
	}
	///
	onsuccess && onsuccess(eventQueue);
};

var stopAudio = function() {
	var ctx = getContext();
	midi.playing = false;
	midi.restart += (ctx.currentTime - startTime) * 1000;
	// stop the audio, and intervals
	while (eventQueue.length) {
		var o = eventQueue.pop();
		window.clearInterval(o.interval);
		if (!o.source) continue; // is not webaudio
		if (typeof(o.source) === 'number') {
			window.clearTimeout(o.source);
		} else { // webaudio
			o.source.disconnect(0);
		}
	}
	// run callback to cancel any notes still playing
	for (var key in noteRegistrar) {
		var o = noteRegistrar[key]
		if (noteRegistrar[key].message === 144 && onMidiEvent) {
			onMidiEvent({
				channel: o.channel,
				note: o.note,
				now: o.now,
				end: o.end,
				message: 128,
				velocity: o.velocity
			});
		}
	}
	// reset noteRegistrar
	noteRegistrar = {};
};

})();

/*
	----------------------------------------------------------
	Web Audio API - OGG or MPEG Soundbank
	----------------------------------------------------------
	http://webaudio.github.io/web-audio-api/
	----------------------------------------------------------
*/

(function(root) { 'use strict';

			(function() {
		var audioContext = null; // new AudioContext();
		var useStreamingBuffer = false; // !!audioContext.createMediaElementSource;
		var midi = root.WebAudio = {api: 'webaudio'};
		var ctx; // audio context
		var sources = {};
		var effects = {};
		var masterVolume = 127;
		var audioBuffers = {};
		///
		midi.audioBuffers = audioBuffers;
		midi.send = function(data, delay) { };
		midi.setController = function(channelId, type, value, delay) { };

		midi.setVolume = function(channelId, volume, delay) {
			if (delay) {
				setTimeout(function() {
					masterVolume = volume;
				}, delay * 1000);
			} else {
				masterVolume = volume;
				var gain = (masterVolume / 127);
				for (var s in midi.audioBuffers)
				{
					midi.audioBuffers[s].gain = Math.min(1.0, Math.max(-1.0, gain))
				}
			}
		}

		midi.programChange = function(channelId, program, delay) {
// 			if (delay) {
// 				return setTimeout(function() {
// 					var channel = root.channels[channelId];
// 					channel.instrument = program;
// 				}, delay);
// 			} else {
				var channel = root.channels[channelId];
				channel.instrument = program;
// 			}
		};

		midi.pitchBend = function(channelId, program, delay) {
// 			if (delay) {
// 				setTimeout(function() {
// 					var channel = root.channels[channelId];
// 					channel.pitchBend = program;
// 				}, delay);
// 			} else {
				var channel = root.channels[channelId];
				channel.pitchBend = program;
// 			}
		};

		midi.noteOn = function(channelId, noteId, velocity, delay) {
			delay = delay || 0;

			/// check whether the note exists
			var channel = root.channels[channelId];
			var instrument = channel.instrument;
			var bufferId = instrument + '' + noteId;
			var buffer = audioBuffers[bufferId];
			if (!buffer) {
// 				console.log(MIDI.GM.byId[instrument].id, instrument, channelId);
				return;
			}

			/// convert relative delay to absolute delay
			if (delay < ctx.currentTime) {
				delay += ctx.currentTime;
			}
		
			/// create audio buffer
			if (useStreamingBuffer) {
				var source = ctx.createMediaElementSource(buffer);
			} else { // XMLHTTP buffer
				var source = ctx.createBufferSource();
				source.buffer = buffer;
			}

			/// add effects to buffer
			if (effects) {
				var chain = source;
				for (var key in effects) {
					chain.connect(effects[key].input);
					chain = effects[key];
				}
			}

			/// add gain + pitchShift
			var gain = (velocity / 127) * (masterVolume / 127) * 2 - 1;
			source.connect(ctx.destination);
			source.playbackRate.value = 1; // pitch shift 
			source.gainNode = ctx.createGain(); // gain
			source.gainNode.connect(ctx.destination);
			source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
			source.connect(source.gainNode);
			///
			if (useStreamingBuffer) {
				if (delay) {
					return setTimeout(function() {
						buffer.currentTime = 0;
						buffer.play()
					}, delay * 1000);
				} else {
					buffer.currentTime = 0;
					buffer.play()
				}
			} else {
				source.start(delay || 0);
			}
			///
			sources[channelId + '' + noteId] = source;
			///
			return source;
		};

		midi.noteOff = function(channelId, noteId, delay) {
			delay = delay || 0;

			/// check whether the note exists
			var channel = root.channels[channelId];
			var instrument = channel.instrument;
			var bufferId = instrument + '' + noteId;
			var buffer = audioBuffers[bufferId];
			if (buffer) {
				if (delay < ctx.currentTime) {
					delay += ctx.currentTime;
				}
				///
				var source = sources[channelId + '' + noteId];
				if (source) {
					if (source.gainNode) {
						// @Miranet: 'the values of 0.2 and 0.3 could of course be used as 
						// a 'release' parameter for ADSR like time settings.'
						// add { 'metadata': { release: 0.3 } } to soundfont files
						var gain = source.gainNode.gain;
						gain.linearRampToValueAtTime(gain.value, delay);
						gain.linearRampToValueAtTime(-1.0, delay + 0.3);
					}
					///
					if (useStreamingBuffer) {
						if (delay) {
							setTimeout(function() {
								buffer.pause();
							}, delay * 1000);
						} else {
							buffer.pause();
						}
					} else {
						if (source.noteOff) {
							source.noteOff(delay + 0.5);
						} else {
							source.stop(delay + 0.5);
						}
					}
					///
					delete sources[channelId + '' + noteId];
					///
					return source;
				}
			}
		};

		midi.chordOn = function(channel, chord, velocity, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOn(channel, note, velocity, delay);
			}
			return res;
		};

		midi.chordOff = function(channel, chord, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOff(channel, note, delay);
			}
			return res;
		};

		midi.stopAllNotes = function() {
			for (var sid in sources) {
				var delay = 0;
				if (delay < ctx.currentTime) {
					delay += ctx.currentTime;
				}
				var source = sources[sid];
				source.gain.linearRampToValueAtTime(1, delay);
				source.gain.linearRampToValueAtTime(0, delay + 0.3);
				if (source.noteOff) { // old api
					source.noteOff(delay + 0.3);
				} else { // new api
					source.stop(delay + 0.3);
				}
				delete sources[sid];
			}
		};
		
		midi.setEffects = function(list) {
			if (ctx.tunajs) {
				for (var n = 0; n < list.length; n ++) {
					var data = list[n];
					var effect = new ctx.tunajs[data.type](data);
					effect.connect(ctx.destination);
					effects[data.type] = effect;
				}
			} else {
				return console.log('Effects module not installed.');
			}
		};

		midi.connect = function(opts) {
			root.setDefaultPlugin(midi);
			midi.setContext(ctx || createAudioContext(), opts.onsuccess);
		};
	
		midi.getContext = function() {
			return ctx;
		};
	
		midi.setContext = function(newCtx, onload, onprogress, onerror) {
			ctx = newCtx;

			/// tuna.js effects module - https://github.com/Dinahmoe/tuna
			if (typeof Tuna !== 'undefined' && !ctx.tunajs) {
				ctx.tunajs = new Tuna(ctx);
			}
		
			/// loading audio files
			var urls = [];
			var notes = root.keyToNote;
			for (var key in notes) urls.push(key);
			///
			var waitForEnd = function(instrument) {
				for (var key in bufferPending) { // has pending items
					if (bufferPending[key]) return;
				}
				///
				if (onload) { // run onload once
					onload();
					onload = null;
				}
			};
			///
			var requestAudio = function(soundfont, instrumentId, index, key) {
				var url = soundfont[key];
				if (url) {
					bufferPending[instrumentId] ++;
					loadAudio(url, function(buffer) {
						buffer.id = key;
						var noteId = root.keyToNote[key];
						audioBuffers[instrumentId + '' + noteId] = buffer;
						///
						if (-- bufferPending[instrumentId] === 0) {
							var percent = index / 87;
							//console.log(MIDI.GM.byId[instrumentId], 'processing: ', percent);
							soundfont.isLoaded = true;
							waitForEnd(instrument);
						}
					}, function(err) {
		// 				console.log(err);
					});
				}
			};
			///
			var bufferPending = {};
			for (var instrument in root.Soundfont) {
				var soundfont = root.Soundfont[instrument];
				if (soundfont.isLoaded) {
					continue;
				}
				///
				var synth = root.GM.byName[instrument];
				var instrumentId = synth.number;
				///
				bufferPending[instrumentId] = 0;
				///
				for (var index = 0; index < urls.length; index++) {
					var key = urls[index];
					requestAudio(soundfont, instrumentId, index, key);
				}
			}
			///
			setTimeout(waitForEnd, 1);
		};

		/* Load audio file: streaming | base64 | arraybuffer
		---------------------------------------------------------------------- */
		function loadAudio(url, onload, onerror) {
			if (useStreamingBuffer) {
				var audio = new Audio();
				audio.src = url;
				audio.controls = false;
				audio.autoplay = false;
				audio.preload = false;
				audio.addEventListener('canplay', function() {
					onload && onload(audio);
				});
				audio.addEventListener('error', function(err) {
					onerror && onerror(err);
				});
				document.body.appendChild(audio);
			} else if (url.indexOf('data:audio') === 0) { // Base64 string
				var base64 = url.split(',')[1];
				var buffer = Base64Binary.decodeArrayBuffer(base64);
				ctx.decodeAudioData(buffer, onload, onerror);
			} else { // XMLHTTP buffer
				var request = new XMLHttpRequest();
				request.open('GET', url, true);
				request.responseType = 'arraybuffer';
				request.onload = function() {
					ctx.decodeAudioData(request.response, onload, onerror);
				};
				request.send();
				console.log("XMLHTTP Buffer");
			}
		};
		
		function createAudioContext() {
			return new (window.AudioContext || window.webkitAudioContext)();
		};
	})();
})(MIDI);
/*
	----------------------------------------------------------------------
	Web MIDI API - Native Soundbanks
	----------------------------------------------------------------------
	http://webaudio.github.io/web-midi-api/
	----------------------------------------------------------------------
*/

(function(root) { 'use strict';

	var plugin = null;
	var output = null;
	var channels = [];
	var midi = root.WebMIDI = {api: 'webmidi'};
	midi.send = function(data, delay) { // set channel volume
		output.send(data, delay * 1000);
	};

	midi.setController = function(channel, type, value, delay) {
		output.send([channel, type, value], delay * 1000);
	};

	midi.setVolume = function(channel, volume, delay) { // set channel volume
		output.send([0xB0 + channel, 0x07, volume], delay * 1000);
	};

	midi.programChange = function(channel, program, delay) { // change patch (instrument)
		output.send([0xC0 + channel, program], delay * 1000);
	};

	midi.pitchBend = function(channel, program, delay) { // pitch bend
		output.send([0xE0 + channel, program], delay * 1000);
	};

	midi.noteOn = function(channel, note, velocity, delay) {
		output.send([0x90 + channel, note, velocity], delay * 1000);
	};

	midi.noteOff = function(channel, note, delay) {
		output.send([0x80 + channel, note, 0], delay * 1000);
	};

	midi.chordOn = function(channel, chord, velocity, delay) {
		for (var n = 0; n < chord.length; n ++) {
			var note = chord[n];
			output.send([0x90 + channel, note, velocity], delay * 1000);
		}
	};

	midi.chordOff = function(channel, chord, delay) {
		for (var n = 0; n < chord.length; n ++) {
			var note = chord[n];
			output.send([0x80 + channel, note, 0], delay * 1000);
		}
	};

	midi.stopAllNotes = function() {
		output.cancel();
		for (var channel = 0; channel < 16; channel ++) {
			output.send([0xB0 + channel, 0x7B, 0]);
		}
	};

	midi.connect = function(opts) {
		root.setDefaultPlugin(midi);
		var errFunction = function(err) { // well at least we tried!
			if (window.AudioContext) { // Chrome
				opts.api = 'webaudio';
			} else if (window.Audio) { // Firefox
				opts.api = 'audiotag';
			} else { // no support
				return;
			}
			root.loadPlugin(opts);
		};
		///
		navigator.requestMIDIAccess().then(function(access) {
			plugin = access;
			var pluginOutputs = plugin.outputs;
			if (typeof pluginOutputs == 'function') { // Chrome pre-43
			  output = pluginOutputs()[0];
			} else { // Chrome post-43
        output = pluginOutputs[0];
			}
			if (output === undefined) { // nothing there...
			  errFunction();
			} else {
			  opts.onsuccess && opts.onsuccess();			
			}
		}, errFunction);
	};

})(MIDI);
/*
	----------------------------------------------------------
	util/Request : 0.1.1 : 2015-03-26
	----------------------------------------------------------
	util.request({
		url: './dir/something.extension',
		data: 'test!',
		format: 'text', // text | xml | json | binary
		responseType: 'text', // arraybuffer | blob | document | json | text
		headers: {},
		withCredentials: true, // true | false
		///
		onerror: function(evt, percent) {
			console.log(evt);
		},
		onsuccess: function(evt, responseText) {
			console.log(responseText);
		},
		onprogress: function(evt, percent) {
			percent = Math.round(percent * 100);
			loader.create('thread', 'loading... ', percent);
		}
	});
*/

if (typeof MIDI === 'undefined') MIDI = {};

(function(root) {

	var util = root.util || (root.util = {});

	util.request = function(opts, onsuccess, onerror, onprogress) { 'use strict';
		if (typeof opts === 'string') opts = {url: opts};
		///
		var data = opts.data;
		var url = opts.url;
		var method = opts.method || (opts.data ? 'POST' : 'GET');
		var format = opts.format;
		var headers = opts.headers;
		var responseType = opts.responseType;
		var withCredentials = opts.withCredentials || false;
		///
		var onsuccess = onsuccess || opts.onsuccess;
		var onerror = onerror || opts.onerror;
		var onprogress = onprogress || opts.onprogress;
		///
		if (typeof NodeFS !== 'undefined' && root.loc.isLocalUrl(url)) {
			NodeFS.readFile(url, 'utf8', function(err, res) {
				if (err) {
					onerror && onerror(err);
				} else {
					onsuccess && onsuccess({responseText: res});
				}
			});
			return;
		}
		///
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		///
		if (headers) {
			for (var type in headers) {
				xhr.setRequestHeader(type, headers[type]);
			}
		} else if (data) { // set the default headers for POST
			xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		}
		if (format === 'binary') { //- default to responseType="blob" when supported
			if (xhr.overrideMimeType) {
				xhr.overrideMimeType('text/plain; charset=x-user-defined');
			}
		}
		if (responseType) {
			xhr.responseType = responseType;
		}
		if (withCredentials) {
			xhr.withCredentials = 'true';
		}
		if (onerror && 'onerror' in xhr) {
			xhr.onerror = onerror;
		}
		if (onprogress && xhr.upload && 'onprogress' in xhr.upload) {
			if (data) {
				xhr.upload.onprogress = function(evt) {
					onprogress.call(xhr, evt, event.loaded / event.total);
				};
			} else {
				xhr.addEventListener('progress', function(evt) {
					var totalBytes = 0;
					if (evt.lengthComputable) {
						totalBytes = evt.total;
					} else if (xhr.totalBytes) {
						totalBytes = xhr.totalBytes;
					} else {
						var rawBytes = parseInt(xhr.getResponseHeader('Content-Length-Raw'));
						if (isFinite(rawBytes)) {
							xhr.totalBytes = totalBytes = rawBytes;
						} else {
							return;
						}
					}
					onprogress.call(xhr, evt, evt.loaded / totalBytes);
				});
			}
		}
		///
		xhr.onreadystatechange = function(evt) {
			if (xhr.readyState === 4) { // The request is complete
				if (xhr.status === 200 || // Response OK
					xhr.status === 304 || // Not Modified
					xhr.status === 308    // Permanent Redirect
					
				) {
					if (onsuccess) {
						var res;
						if (format === 'xml') {
							res = evt.target.responseXML;
						} else if (format === 'text') {
							res = evt.target.responseText;
						} else if (format === 'json') {
							try {
								res = JSON.parse(evt.target.response);
							} catch(err) {
								onerror && onerror.call(xhr, evt);
							}
						}
						///
						onsuccess.call(xhr, evt, res);
					}
				} else {
					onerror && onerror.call(xhr, evt);
				}
			}
		};
		xhr.send(data);
		return xhr;
	};

	/// NodeJS
	if (typeof module !== 'undefined' && module.exports) {
		var NodeFS = require('fs');
		XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
		module.exports = root.util.request;
	}

})(MIDI);
/*
	-----------------------------------------------------------
	dom.loadScript.js : 0.1.4 : 2014/02/12 : http://mudcu.be
	-----------------------------------------------------------
	Copyright 2011-2014 Mudcube. All rights reserved.
	-----------------------------------------------------------
	/// No verification
	dom.loadScript.add("../js/jszip/jszip.js");
	/// Strict loading order and verification.
	dom.loadScript.add({
		strictOrder: true,
		urls: [
			{
				url: "../js/jszip/jszip.js",
				verify: "JSZip",
				onsuccess: function() {
					console.log(1)
				}
			},
			{ 
				url: "../inc/downloadify/js/swfobject.js",
				verify: "swfobject",
				onsuccess: function() {
					console.log(2)
				}
			}
		],
		onsuccess: function() {
			console.log(3)
		}
	});
	/// Just verification.
	dom.loadScript.add({
		url: "../js/jszip/jszip.js",
		verify: "JSZip",
		onsuccess: function() {
			console.log(1)
		}
	});
*/

if (typeof(dom) === "undefined") var dom = {};

(function() { "use strict";

dom.loadScript = function() {
	this.loaded = {};
	this.loading = {};
	return this;
};

dom.loadScript.prototype.add = function(config) {
	var that = this;
	if (typeof(config) === "string") {
		config = { url: config };
	}
	var urls = config.urls;
	if (typeof(urls) === "undefined") {
		urls = [{ 
			url: config.url, 
			verify: config.verify
		}];
	}
	/// adding the elements to the head
	var doc = document.getElementsByTagName("head")[0];
	/// 
	var testElement = function(element, test) {
		if (that.loaded[element.url]) return;
		if (test && globalExists(test) === false) return;
		that.loaded[element.url] = true;
		//
		if (that.loading[element.url]) that.loading[element.url]();
		delete that.loading[element.url];
		//
		if (element.onsuccess) element.onsuccess();
		if (typeof(getNext) !== "undefined") getNext();
	};
	///
	var hasError = false;
	var batchTest = [];
	var addElement = function(element) {
		if (typeof(element) === "string") {
			element = {
				url: element,
				verify: config.verify
			};
		}
		if (/([\w\d.\[\]\'\"])$/.test(element.verify)) { // check whether its a variable reference
			var verify = element.test = element.verify;
			if (typeof(verify) === "object") {
				for (var n = 0; n < verify.length; n ++) {
					batchTest.push(verify[n]);
				}			
			} else {
				batchTest.push(verify);
			}
		}
		if (that.loaded[element.url]) return;
		var script = document.createElement("script");
		script.onreadystatechange = function() {
			if (this.readyState !== "loaded" && this.readyState !== "complete") return;
			testElement(element);
		};
		script.onload = function() {
			testElement(element);
		};
		script.onerror = function() {
			hasError = true;
			delete that.loading[element.url];
			if (typeof(element.test) === "object") {
				for (var key in element.test) {
					removeTest(element.test[key]);
				}			
			} else {
				removeTest(element.test);
			}
		};
		script.setAttribute("type", "text/javascript");
		script.setAttribute("src", element.url);
		doc.appendChild(script);
		that.loading[element.url] = function() {};
	};
	/// checking to see whether everything loaded properly
	var removeTest = function(test) {
		var ret = [];
		for (var n = 0; n < batchTest.length; n ++) {
			if (batchTest[n] === test) continue;
			ret.push(batchTest[n]);
		}
		batchTest = ret;
	};
	var onLoad = function(element) {
		if (element) {
			testElement(element, element.test);
		} else {
			for (var n = 0; n < urls.length; n ++) {
				testElement(urls[n], urls[n].test);
			}
		}
		var istrue = true;
		for (var n = 0; n < batchTest.length; n ++) {
			if (globalExists(batchTest[n]) === false) {
				istrue = false;
			}
		}
		if (!config.strictOrder && istrue) { // finished loading all the requested scripts
			if (hasError) {
				if (config.error) {
					config.error();
				}
			} else if (config.onsuccess) {
				config.onsuccess();
			}
		} else { // keep calling back the function
			setTimeout(function() { //- should get slower over time?
				onLoad(element);
			}, 10);
		}
	};
	/// loading methods;  strict ordering or loose ordering
	if (config.strictOrder) {
		var ID = -1;
		var getNext = function() {
			ID ++;
			if (!urls[ID]) { // all elements are loaded
				if (hasError) {
					if (config.error) {
						config.error();
					}
				} else if (config.onsuccess) {
					config.onsuccess();
				}
			} else { // loading new script
				var element = urls[ID];
				var url = element.url;
				if (that.loading[url]) { // already loading from another call (attach to event)
					that.loading[url] = function() {
						if (element.onsuccess) element.onsuccess();
						getNext();
					}
				} else if (!that.loaded[url]) { // create script element
					addElement(element);
					onLoad(element);
				} else { // it's already been successfully loaded
					getNext();
				}
			}
		};
		getNext();
	} else { // loose ordering
		for (var ID = 0; ID < urls.length; ID ++) {
			addElement(urls[ID]);
			onLoad(urls[ID]);
		}
	}
};

dom.loadScript = new dom.loadScript();

var globalExists = function(path, root) {
	try {
		path = path.split('"').join('').split("'").join('').split(']').join('').split('[').join('.');
		var parts = path.split(".");
		var length = parts.length;
		var object = root || window;
		for (var n = 0; n < length; n ++) {
			var key = parts[n];
			if (object[key] == null) {
				return false;
			} else { //
				object = object[key];
			}
		}
		return true;
	} catch(e) {
		return false;
	}
};

})();

/// For NodeJS
if (typeof (module) !== "undefined" && module.exports) {
	module.exports = dom.loadScript;
}

/**
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 * ----------------------------------------------
 *
 * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
 * Thank you all, you're awesome!
 */

// Include a performance.now polyfill
(function () {

	if ('performance' in window === false) {
		window.performance = {};
	}

	// IE 8
	Date.now = (Date.now || function () {
		return new Date().getTime();
	});

	if ('now' in window.performance === false) {
		var offset = window.performance.timing && window.performance.timing.navigationStart ? window.performance.timing.navigationStart
		                                                                                    : Date.now();

		window.performance.now = function () {
			return Date.now() - offset;
		};
	}

})();

var TWEEN = TWEEN || (function () {

	var _tweens = [];

	return {

		getAll: function () {

			return _tweens;

		},

		removeAll: function () {

			_tweens = [];

		},

		add: function (tween) {

			_tweens.push(tween);

		},

		remove: function (tween) {

			var i = _tweens.indexOf(tween);

			if (i !== -1) {
				_tweens.splice(i, 1);
			}

		},

		update: function (time) {

			if (_tweens.length === 0) {
				return false;
			}

			var i = 0;

			time = time !== undefined ? time : window.performance.now();

			while (i < _tweens.length) {

				if (_tweens[i].update(time)) {
					i++;
				} else {
					_tweens.splice(i, 1);
				}

			}

			return true;

		}
	};

})();

TWEEN.Tween = function (object) {

	var _object = object;
	var _valuesStart = {};
	var _valuesEnd = {};
	var _valuesStartRepeat = {};
	var _duration = 1000;
	var _repeat = 0;
	var _yoyo = false;
	var _isPlaying = false;
	var _reversed = false;
	var _delayTime = 0;
	var _startTime = null;
	var _easingFunction = TWEEN.Easing.Linear.None;
	var _interpolationFunction = TWEEN.Interpolation.Linear;
	var _chainedTweens = [];
	var _onStartCallback = null;
	var _onStartCallbackFired = false;
	var _onUpdateCallback = null;
	var _onCompleteCallback = null;
	var _onStopCallback = null;

	// Set all starting values present on the target object
	for (var field in object) {
		_valuesStart[field] = parseFloat(object[field], 10);
	}

	this.to = function (properties, duration) {

		if (duration !== undefined) {
			_duration = duration;
		}

		_valuesEnd = properties;

		return this;

	};

	this.start = function (time) {

		TWEEN.add(this);

		_isPlaying = true;

		_onStartCallbackFired = false;

		_startTime = time !== undefined ? time : window.performance.now();
		_startTime += _delayTime;

		for (var property in _valuesEnd) {

			// Check if an Array was provided as property value
			if (_valuesEnd[property] instanceof Array) {

				if (_valuesEnd[property].length === 0) {
					continue;
				}

				// Create a local copy of the Array with the start value at the front
				_valuesEnd[property] = [_object[property]].concat(_valuesEnd[property]);

			}

			// If `to()` specifies a property that doesn't exist in the source object,
			// we should not set that property in the object
			if (_valuesStart[property] === undefined) {
				continue;
			}

			_valuesStart[property] = _object[property];

			if ((_valuesStart[property] instanceof Array) === false) {
				_valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
			}

			_valuesStartRepeat[property] = _valuesStart[property] || 0;

		}

		return this;

	};

	this.stop = function () {

		if (!_isPlaying) {
			return this;
		}

		TWEEN.remove(this);
		_isPlaying = false;

		if (_onStopCallback !== null) {
			_onStopCallback.call(_object);
		}

		this.stopChainedTweens();
		return this;

	};

	this.stopChainedTweens = function () {

		for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
			_chainedTweens[i].stop();
		}

	};

	this.delay = function (amount) {

		_delayTime = amount;
		return this;

	};

	this.repeat = function (times) {

		_repeat = times;
		return this;

	};

	this.yoyo = function (yoyo) {

		_yoyo = yoyo;
		return this;

	};


	this.easing = function (easing) {

		_easingFunction = easing;
		return this;

	};

	this.interpolation = function (interpolation) {

		_interpolationFunction = interpolation;
		return this;

	};

	this.chain = function () {

		_chainedTweens = arguments;
		return this;

	};

	this.onStart = function (callback) {

		_onStartCallback = callback;
		return this;

	};

	this.onUpdate = function (callback) {

		_onUpdateCallback = callback;
		return this;

	};

	this.onComplete = function (callback) {

		_onCompleteCallback = callback;
		return this;

	};

	this.onStop = function (callback) {

		_onStopCallback = callback;
		return this;

	};

	this.update = function (time) {

		var property;
		var elapsed;
		var value;

		if (time < _startTime) {
			return true;
		}

		if (_onStartCallbackFired === false) {

			if (_onStartCallback !== null) {
				_onStartCallback.call(_object);
			}

			_onStartCallbackFired = true;

		}

		elapsed = (time - _startTime) / _duration;
		elapsed = elapsed > 1 ? 1 : elapsed;

		value = _easingFunction(elapsed);

		for (property in _valuesEnd) {

			// Don't update properties that do not exist in the source object
			if (_valuesStart[property] === undefined) {
				continue;
			}

			var start = _valuesStart[property] || 0;
			var end = _valuesEnd[property];

			if (end instanceof Array) {

				_object[property] = _interpolationFunction(end, value);

			} else {

				// Parses relative end values with start as base (e.g.: +10, -3)
				if (typeof (end) === 'string') {

					if (end.startsWith('+') || end.startsWith('-')) {
						end = start + parseFloat(end, 10);
					} else {
						end = parseFloat(end, 10);
					}
				}

				// Protect against non numeric properties.
				if (typeof (end) === 'number') {
					_object[property] = start + (end - start) * value;
				}

			}

		}

		if (_onUpdateCallback !== null) {
			_onUpdateCallback.call(_object, value);
		}

		if (elapsed === 1) {

			if (_repeat > 0) {

				if (isFinite(_repeat)) {
					_repeat--;
				}

				// Reassign starting values, restart by making startTime = now
				for (property in _valuesStartRepeat) {

					if (typeof (_valuesEnd[property]) === 'string') {
						_valuesStartRepeat[property] = _valuesStartRepeat[property] + parseFloat(_valuesEnd[property], 10);
					}

					if (_yoyo) {
						var tmp = _valuesStartRepeat[property];

						_valuesStartRepeat[property] = _valuesEnd[property];
						_valuesEnd[property] = tmp;
					}

					_valuesStart[property] = _valuesStartRepeat[property];

				}

				if (_yoyo) {
					_reversed = !_reversed;
				}

				_startTime = time + _delayTime;

				return true;

			} else {

				if (_onCompleteCallback !== null) {
					_onCompleteCallback.call(_object);
				}

				for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
					// Make the chained tweens start exactly at the time they should,
					// even if the `update()` method was called way past the duration of the tween
					_chainedTweens[i].start(_startTime + _duration);
				}

				return false;

			}

		}

		return true;

	};

};


TWEEN.Easing = {

	Linear: {

		None: function (k) {

			return k;

		}

	},

	Quadratic: {

		In: function (k) {

			return k * k;

		},

		Out: function (k) {

			return k * (2 - k);

		},

		InOut: function (k) {

			if ((k *= 2) < 1) {
				return 0.5 * k * k;
			}

			return - 0.5 * (--k * (k - 2) - 1);

		}

	},

	Cubic: {

		In: function (k) {

			return k * k * k;

		},

		Out: function (k) {

			return --k * k * k + 1;

		},

		InOut: function (k) {

			if ((k *= 2) < 1) {
				return 0.5 * k * k * k;
			}

			return 0.5 * ((k -= 2) * k * k + 2);

		}

	},

	Quartic: {

		In: function (k) {

			return k * k * k * k;

		},

		Out: function (k) {

			return 1 - (--k * k * k * k);

		},

		InOut: function (k) {

			if ((k *= 2) < 1) {
				return 0.5 * k * k * k * k;
			}

			return - 0.5 * ((k -= 2) * k * k * k - 2);

		}

	},

	Quintic: {

		In: function (k) {

			return k * k * k * k * k;

		},

		Out: function (k) {

			return --k * k * k * k * k + 1;

		},

		InOut: function (k) {

			if ((k *= 2) < 1) {
				return 0.5 * k * k * k * k * k;
			}

			return 0.5 * ((k -= 2) * k * k * k * k + 2);

		}

	},

	Sinusoidal: {

		In: function (k) {

			return 1 - Math.cos(k * Math.PI / 2);

		},

		Out: function (k) {

			return Math.sin(k * Math.PI / 2);

		},

		InOut: function (k) {

			return 0.5 * (1 - Math.cos(Math.PI * k));

		}

	},

	Exponential: {

		In: function (k) {

			return k === 0 ? 0 : Math.pow(1024, k - 1);

		},

		Out: function (k) {

			return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);

		},

		InOut: function (k) {

			if (k === 0) {
				return 0;
			}

			if (k === 1) {
				return 1;
			}

			if ((k *= 2) < 1) {
				return 0.5 * Math.pow(1024, k - 1);
			}

			return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);

		}

	},

	Circular: {

		In: function (k) {

			return 1 - Math.sqrt(1 - k * k);

		},

		Out: function (k) {

			return Math.sqrt(1 - (--k * k));

		},

		InOut: function (k) {

			if ((k *= 2) < 1) {
				return - 0.5 * (Math.sqrt(1 - k * k) - 1);
			}

			return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);

		}

	},

	Elastic: {

		In: function (k) {

			var s;
			var a = 0.1;
			var p = 0.4;

			if (k === 0) {
				return 0;
			}

			if (k === 1) {
				return 1;
			}

			if (!a || a < 1) {
				a = 1;
				s = p / 4;
			} else {
				s = p * Math.asin(1 / a) / (2 * Math.PI);
			}

			return - (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));

		},

		Out: function (k) {

			var s;
			var a = 0.1;
			var p = 0.4;

			if (k === 0) {
				return 0;
			}

			if (k === 1) {
				return 1;
			}

			if (!a || a < 1) {
				a = 1;
				s = p / 4;
			} else {
				s = p * Math.asin(1 / a) / (2 * Math.PI);
			}

			return (a * Math.pow(2, - 10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1);

		},

		InOut: function (k) {

			var s;
			var a = 0.1;
			var p = 0.4;

			if (k === 0) {
				return 0;
			}

			if (k === 1) {
				return 1;
			}

			if (!a || a < 1) {
				a = 1;
				s = p / 4;
			} else {
				s = p * Math.asin(1 / a) / (2 * Math.PI);
			}

			if ((k *= 2) < 1) {
				return - 0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
			}

			return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;

		}

	},

	Back: {

		In: function (k) {

			var s = 1.70158;

			return k * k * ((s + 1) * k - s);

		},

		Out: function (k) {

			var s = 1.70158;

			return --k * k * ((s + 1) * k + s) + 1;

		},

		InOut: function (k) {

			var s = 1.70158 * 1.525;

			if ((k *= 2) < 1) {
				return 0.5 * (k * k * ((s + 1) * k - s));
			}

			return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);

		}

	},

	Bounce: {

		In: function (k) {

			return 1 - TWEEN.Easing.Bounce.Out(1 - k);

		},

		Out: function (k) {

			if (k < (1 / 2.75)) {
				return 7.5625 * k * k;
			} else if (k < (2 / 2.75)) {
				return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
			} else if (k < (2.5 / 2.75)) {
				return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
			} else {
				return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
			}

		},

		InOut: function (k) {

			if (k < 0.5) {
				return TWEEN.Easing.Bounce.In(k * 2) * 0.5;
			}

			return TWEEN.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;

		}

	}

};

TWEEN.Interpolation = {

	Linear: function (v, k) {

		var m = v.length - 1;
		var f = m * k;
		var i = Math.floor(f);
		var fn = TWEEN.Interpolation.Utils.Linear;

		if (k < 0) {
			return fn(v[0], v[1], f);
		}

		if (k > 1) {
			return fn(v[m], v[m - 1], m - f);
		}

		return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);

	},

	Bezier: function (v, k) {

		var b = 0;
		var n = v.length - 1;
		var pw = Math.pow;
		var bn = TWEEN.Interpolation.Utils.Bernstein;

		for (var i = 0; i <= n; i++) {
			b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
		}

		return b;

	},

	CatmullRom: function (v, k) {

		var m = v.length - 1;
		var f = m * k;
		var i = Math.floor(f);
		var fn = TWEEN.Interpolation.Utils.CatmullRom;

		if (v[0] === v[m]) {

			if (k < 0) {
				i = Math.floor(f = m * (1 + k));
			}

			return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);

		} else {

			if (k < 0) {
				return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
			}

			if (k > 1) {
				return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
			}

			return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);

		}

	},

	Utils: {

		Linear: function (p0, p1, t) {

			return (p1 - p0) * t + p0;

		},

		Bernstein: function (n, i) {

			var fc = TWEEN.Interpolation.Utils.Factorial;

			return fc(n) / fc(i) / fc(n - i);

		},

		Factorial: (function () {

			var a = [1];

			return function (n) {

				var s = 1;

				if (a[n]) {
					return a[n];
				}

				for (var i = n; i > 1; i--) {
					s *= i;
				}

				a[n] = s;
				return s;

			};

		})(),

		CatmullRom: function (p0, p1, p2, p3, t) {

			var v0 = (p2 - p0) * 0.5;
			var v1 = (p3 - p1) * 0.5;
			var t2 = t * t;
			var t3 = t * t2;

			return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (- 3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;

		}

	}

};

// UMD (Universal Module Definition)
(function (root) {

	if (typeof define === 'function' && define.amd) {

		// AMD
		define([], function () {
			return TWEEN;
		});

	} else if (typeof module !== 'undefined' && typeof exports === 'object') {

		// Node.js
		module.exports = TWEEN;

	} else if (root !== undefined) {

		// Global variable
		root.TWEEN = TWEEN;

	}

})(this);
