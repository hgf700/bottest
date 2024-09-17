const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { token } = require('./config.json');
const ytdl = require('ytdl-core');
const { EventEmitter } = require('events');
class AudioPlayer extends EventEmitter {
    checkPlayable(){}
    unpause(){}
    pause(){}
    stop(){}
}

const bot = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

bot.once('ready', () => {
    console.log(`${bot.user.tag} is ready`);

    const playCommand = new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music track')
        .addStringOption(option =>
            option
                .setName('musicurl')
                .setDescription('Insert music URL')
                .setRequired(true));

    const pauseCommand = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('It allows pause currently played track');
    
    const unpauseCommand = new SlashCommandBuilder()
        .setName('unpause')
        .setDescription('It allows unpause currently paused track');

    const stopCommand = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('It allows to stop entire bot');

    const loopCommand = new SlashCommandBuilder()
        .setName('loop')
        .setDescription('It allows to loop current track');

    const skipCommand = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('It allows to skip current track');

    const currentlyplayedCommand = new SlashCommandBuilder()
        .setName('currentlyplayed')
        .setDescription('It allows to check curently played track');

    bot.guilds.cache.forEach(guild => {
        try {
            guild.commands.create(playCommand);
            guild.commands.create(pauseCommand);
            guild.commands.create(unpauseCommand);
            guild.commands.create(stopCommand);
            guild.commands.create(loopCommand);
            guild.commands.create(skipCommand);
            guild.commands.create(currentlyplayedCommand);
        } catch (error) {
            console.error(`Error creating slash commands for guild ${guild.id}: ${error}`);
        }
    });
});

const musicUrls = [];
let player;
let resource;
let connection;
let loop=false;

bot.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'play') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            return;
        }
        else {
            let url = interaction.options.getString('musicurl');
    
            if (ytdl.validateURL(url)) {
                console.log('Valid URL');

                if (player && (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused)) {
                    musicUrls.push(url);
                } else {
                musicUrls.push(url);
                connectAndPlay(voiceChannel, url);
                }

            } else {
                interaction.reply('Invalid URL provided!');
                console.log('Invalid URL provided!');
            }
        }
    }
    
    if (interaction.commandName === 'pause') {
        if (!connection) {
            await interaction.reply({ content: 'No active connection!', ephemeral: true });
            return;
        }
        else{
            if(player.state.status === AudioPlayerStatus.Playing){
                console.log('pauseing current track');
                player.pause();
            }
            else{
                console.log('first tranck needs to be played');
            }  
        }          
    }

    if (interaction.commandName === 'unpause') {
        if (!connection) {
            await interaction.reply({ content: 'No active connection!', ephemeral: true });
            return;
        }
        else{            
            if(player.state.status === AudioPlayerStatus.Paused){
                console.log('attempting to unpause');
                player.unpause();
            }
            else{
                console.log('currently track is already played')
            }
        }     
    }

    if (interaction.commandName === 'stop') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            return;
        }
        else{
            if(player.state.status === AudioPlayerStatus.Idle){
                console.log('you need to first play track');
            }
            if(player.state.status === AudioPlayerStatus.Paused || player.state.status === AudioPlayerStatus.Playing){
                console.log('bot stopped playing and lost connection');
                connection.destroy();
            }
        }        
    }

    if (interaction.commandName === 'loop') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            return;
        }
        else{
            if(player.state.status === AudioPlayerStatus.Playing && loop===false){
                console.log('looping current track');
                loop=true;
            }
            else{
                console.log('unnlooping');
                loop =false;
            }
        }
    }

    if (interaction.commandName === 'skip') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            return;
        }
        else{
            if(player.state.status === AudioPlayerStatus.Playing && musicUrls.length>1){
                musicUrls.shift();
                console.log('track skipped')
            }
            else{
                console.log('to skip required are at lesat 2 tracks in queue')
            }
        }
    }
    if (interaction.commandName === 'currentlyplayed') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            return;
        }
        else{
            let currentlyplayedmusic=musicUrls[0];
            console.log(`${currentlyplayedmusic}`);
        }
    }
    
});

async function playSong(interaction, connection) {
    const stream = ytdl(musicUrls[0], { filter: "audioonly" });
    console.log('create audio player');
    if(player===true){
        console.log('player exists');
    }
    else{
        player = createAudioPlayer();
        resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        console.log('play');
        player.play(resource);
        connection.subscribe(player);
    }
    
    player.on('stateChange', (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if(loop===false){
                console.log('unlooped');
                musicUrls.shift();
                
                if (musicUrls.length > 0) {
                    console.log('play in queue');
                    playSong(interaction, connection);
                } else {
                    console.log('destroying connection');
                    connection.destroy();
                }
            }  
            else{
                console.log('looped');
                if (musicUrls.length > 0) {
                    console.log('play in queue');
                    playSong(interaction, connection);
                } else {
                    console.log('destroying connection');
                    connection.destroy();
                }
            }          
        }
    });

    connection.on('disconnect', () => {
        interaction.channel.send('Music playback finished.');
    });

    player.on('error', error => {
        console.error('Audio player error:', error);
    });

    connection.on('error', error => {
        console.error('Voice connection error:', error);
    });
}

async function connectAndPlay(voiceChannel, url) {
    try {
        console.log('connection');
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        console.log('playing audio');
        playSong(url, connection);
    } catch (error) {
        console.error('Error occurred while joining voice channel:', error);
        interaction.reply('An error occurred while joining voice channel.');
    }
}    
//wypierdala error pewnie przez ytdl mimo ze jest audio only a chce chyba video?
//Exception has occurred: TypeError: Cannot read properties of undefined (reading 'relatedVideoArgs')
//  at exports.getRelatedVideos (C:\bottest\node_modules\ytdl-core\lib\info-extras.js:201:65)
 // at exports.getBasicInfo (C:\bottest\node_modules\ytdl-core\lib\info.js:77:28)
 // at process.processTicksAndRejections (node:internal/process/task_queues:95:5)

bot.login(token);
