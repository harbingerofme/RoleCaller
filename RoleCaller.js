const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config/config.json');
const gm = require('gm');

const cleanupInterval = config.cleanupInterval;
const messageDeleteDelay = config.messageDeleteDelay;
const noColorMsgDelay = config.noColorMsgDelay;

cleanUpStack = [];

print = function (message) { //for prettier printing.
    console.log(`[${new Date().toLocaleTimeString('en-GB', { hour12: false, timeZoneName: 'short' })}] ${message}`);
}

client.on('ready', () => {
    print(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({ game: { name: config.status }, status: 'online' })
        .then(print(`Presence set to: "${config.status}"`))
        .catch(console.error);
    let x = 0;
    client.guilds.forEach(g => {
        x++;
        scheduleCleanup(g, Math.floor(x / 2));
    });
    print(`Scheduling ${x} cleanup events.`)
    setInterval(scheduledCleanup, cleanupInterval);
});

client.on('message', (message) => {
    if (message.author.bot == false && message.guild && message.cleanContent.toLowerCase().startsWith(".iwant")) {
        let color = message.cleanContent.split(" ", 2)[1];
        if (color == "nothing") {
            stripUser(message.member);
            message.channel.send("Removed all RC roles.").then(null).catch(null);
            return;
        }
        if (color == "help") {
            message.channel.send(config.help).then(() => { }).catch(console.log)
            return;
        }
        if (color !== undefined) {
            color = color.toLowerCase();
            if (color.startsWith("#"))
                color = color.slice(1);
            if (color.startsWith("0x"))
                color = color.slice(2);
            let re = /^[\da-f]{6}$/;
            if (!re.test(color)) {
                color = message.cleanContent.split("").reduce((acc, cur, index) => {
                    return ((index == 1 ? acc.charCodeAt(0) : +acc) * cur.charCodeAt(0) + 15) % 16581375;
                }).toString(16);
                while (color.length < 6)
                    color = "0" + color;
            }
            if (color == "000000")
                color = "000001";
            let guild = message.guild;
            let name = message.member.displayName
            gm("in.png")

                .fill("none")
                .stroke("#" + color)
                .drawRectangle(185, 81, 265, 101)
                .drawRectangle(0, 0, 267, 103)

                .stroke("none")
                .fill("#000000")
                .font(config.consolaLoc, 16)
                .drawText(194, 97, "#" + color)

                .fill("#" + color)
                .font(config.whitneyLoc, 16)
                .drawText(5, 20, name)
                .drawText(5, 70, name)


                .write("out.png", () => {
                    message.channel.send({ files: [{ attachment: 'out.png', name: 'preview.png' }] })
                        .then(
                            (myMsg) => {
                                myMsg.react("✅")
                                    .then(() => myMsg.react("❎")
                                        .then(() => {
                                            myMsg.awaitReactions((react, user) => { return "✅❎".includes(react.emoji.name) && user.id == message.author.id }, { max: 1, time: 1000 * 60 * 60, errors: ['time'] })
                                                .then((collected) => {
                                                    const reaction = collected.first();
                                                    if (reaction.emoji.name === '✅') {
                                                        stripUser(message.member);
                                                        guild.createRole({ "name": `RC: ${color}`, "color": color })
                                                            .then((role) => {
                                                                print(`Created role '${role.name}' in '${guild.name}'`)
                                                                message.member.addRole(role)
                                                                    .then(null)
                                                                    .catch(() => { print(`Failed assigning color ${color} in ${guild.name}!`) });
                                                            })
                                                            .catch(() => { print(`Failed creating role 'RC: ${color}' in '${guild.name}'`) })
                                                        myMsg.delete().then(() => {
                                                            message.channel.send(`${message.member.displayName}, you now have the color ${color}`)
                                                                .then((msg) => {
                                                                    message.delete(messageDeleteDelay)
                                                                        .then(() => { msg.edit(`<@${message.member.id}>, you now have the color ${color}`) })
                                                                        .catch(() => { msg.delete(); })
                                                                })
                                                                .catch(() => { })
                                                        })
                                                            .catch(null)
                                                    }
                                                    else {
                                                        myMsg.delete().then(() => {
                                                            message.channel.send("Color not assigned.")
                                                                .then((msg) => { msg.delete(noColorMsgDelay).then(() => message.delete().catch(() => { })).catch(() => { }) })
                                                                .catch(() => { })
                                                        }).catch(null)
                                                    }
                                                })
                                                .catch(() => { })
                                        })
                                        .catch(() => { print(`Error reacting in '${guild.name}'`) }))
                                    .catch(() => { print(`Error reacting in '${guild.name}'`) })
                            })
                        .catch(() => { print(`Error sending message in ${guild.id}`) })
                })
        }
    }
});

client.on('message', (message) => {
    if (!message.author.bot && message.cleanContent.toLowerCase() == ".cleanup") {
        let count = cleanupGuild(message.guild);
        if (count > 0)
            message.channel.send(`Cleanup: deleted ${count} role${count > 1 ? "s" : ""}`);
        else
            message.channel.send(`All RC roles are in use.`)
    }
});

cleanupGuild = function (guild) {
    let roles = guild.roles.filter((x) => {
        return x.name.startsWith("RC: ") && x.editable && x.members.array().length == 0;
    })
    let count = 0;
    roles.forEach((r) => {
        count++;
        r.delete("Cleanup: nobody is using this role.").then(null).catch(null);
    })
    return count;
}

scheduleCleanup = function (guild, delay = 0) {
    cleanUpStack.push([guild, Date.now() + delay * cleanupInterval]);
}

scheduledCleanup = function () {
    let now = Date.now();
    let rolesDeleted = 0;
    let handled = [];
    while (cleanUpStack.length && cleanUpStack[0][1] < now) {
        let g = cleanUpStack.pop()[0];
        if (!(handled.includes(g.id))) {
            rolesDeleted += cleanupGuild(g);
            handled.push(g.id);
        }
    }
    if (rolesDeleted)
        print(`Cleanup: deleted ${rolesDeleted} role${rolesDeleted > 1 ? "s" : ""}`);
}

stripUser = function (guildMember) {
    let roles = guildMember.roles.filter((x) => { return x.name.startsWith("RC:") && x.editable });
    let arr = roles.array()
    if (arr.length > 0) {
        guildMember.removeRoles(roles)
            .then(() => { /*print(`Removed ${arr.length} role${arr.length == 1 ? "" : "s"} from ${guildMember.displayName}`) */ })
            .catch(() => { print(`Failed removing roles from ${guildMember.displayName}`) });
        scheduleCleanup(guildMember.guild);
    }
}

drawName = function (color, name) {
    gm("in.png")

        .fill("#000000")
        .font(config.consolaLoc, 16)
        .drawText(301 - 73, 109 - 18, "#" + color)
        .drawRectangle((301 - 82, 109 - 22), (301 - 2, 109 - 2))

        .fill("#" + color)
        .drawRectangle((301 - 82, 109 - 22), (301 - 3, 109 - 3))

        .font(config.whitneyLoc, 16)
        .drawText(5, 20, name)
        .drawText(5, 70, name)
        .drawRectangle(0, 0, 301, 109)

        .write("out.png", () => { })
}

client.login(config.token);