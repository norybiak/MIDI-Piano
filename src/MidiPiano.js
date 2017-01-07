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
