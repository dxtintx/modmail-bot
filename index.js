const {
    Client,
    IntentsBitField,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    SlashCommandUserOption,
    EmbedBuilder,
    MessageFlags,
    Partials,
    SlashCommandNumberOption,
    SlashCommandBooleanOption,
    DMChannel,
} = require("discord.js");
const client = new Client({
    intents: [
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
    ],
    partials: [Partials.Channel],
});
const fs = require("fs");
const path = require("path");
const [wlPath, mailsPath] = ["/data/whitelist.json", "/data/mails.json"];
const dotenv = require("dotenv").config({
    path: process.argv[2] == "dev" ? ".env.development" : ".env",
});
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { TOKEN, CLIENT_ID } = process.env;

const rest = new REST({ version: "10" }).setToken(TOKEN);

const commands = [
    new SlashCommandBuilder().setName("mails").setDescription("Get all mails"),
    new SlashCommandBuilder()
        .setName("close")
        .setDescription("Close taken mail"),
    new SlashCommandBuilder()
        .setName("whitelist_add")
        .setDescription(
            "Add user to whitelist and making him able to have access to this server's mail"
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(
            new SlashCommandUserOption()
                .setName("user")
                .setDescription("User")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("whitelist_remove")
        .setDescription(
            "Remove user from whitelist and making him not able to have access to this server's mail"
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(
            new SlashCommandUserOption()
                .setName("user")
                .setDescription("User")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("respond")
        .setDescription("Respond to mail")
        .addNumberOption(
            new SlashCommandNumberOption()
                .setRequired(true)
                .setName("id")
                .setDescription("Mail ID")
        ),
];

commands.forEach((c) => {
    c.addBooleanOption(
        new SlashCommandBooleanOption()
            .setName("ephemeral")
            .setDescription("Ephemeral Reply (default = true)")
            .setRequired(false)
    );
});

if (!fs.existsSync(path.resolve(__dirname + "/data"))) {
    fs.mkdir(path.resolve(__dirname + "/data"), (err) => {
        if (err) throw err;
    });
}
if (!fs.existsSync(path.resolve(__dirname + wlPath))) {
    console.log("Whitelist file not found, creating...");
    fs.writeFile(path.resolve(__dirname + wlPath), "[]", (err) => {
        if (err) throw err;
    });
}
if (!fs.existsSync(path.resolve(__dirname + mailsPath))) {
    console.log("Mails file not found, creating...");
    fs.writeFile(path.resolve(__dirname + mailsPath), "[]", (err) => {
        if (err) throw err;
    });
}

if (!TOKEN || !CLIENT_ID) {
    throw new Error(
        "Token or Client ID is not defined. Please follow to .env file and enter it."
    );
}

async function loadcommand() {
    try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands,
        });

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
}

loadcommand();

client.login(TOKEN);

client.on(Events.ClientReady, () => {
    console.log("Modmail is active");
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !(message.channel instanceof DMChannel)) return;
    var mails = JSON.parse(
        fs.readFileSync(path.resolve(__dirname + mailsPath))
    );
    var whitelist = JSON.parse(
        fs.readFileSync(path.resolve(__dirname + wlPath))
    );
    if (whitelist.indexOf(message.author.id) != -1) {
        var mail = mails.filter((m) => m.takenBy == message.author.id);
        if (mail.length > 0 && mail[0].from) {
            var user = await client.users.fetch(mail[0].from);
            return user.send({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(message.content)
                        .setAuthor({
                            name: `Response from ${message.author.tag}`,
                            iconURL: message.author.displayAvatarURL(),
                        })
                        .setColor(0x00ff00)
                        .setTimestamp(),
                ],
            });
        } else {
            message.channel.sendTyping();
            return await message.reply(
                "You have no taken mails. Use </mails:1438888694248509441> to see all mails and </respond:1439199278512869379> to take one."
            );
        }
    } else {
        if (mails.filter((m) => m.from == message.author.id).length > 0) {
            var mail = mails.filter((m) => m.from == message.author.id);
            if (mail[0].takenBy != null) {
                var mod = await client.users.fetch(mail[0].takenBy);
                mod.send({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(message.content)
                            .setAuthor({
                                name: `Response from ${message.author.tag} (Mail ID: ${mail[0].id})`,
                                iconURL: message.author.displayAvatarURL(),
                            })
                            .setColor(0x00ff00)
                            .setTimestamp(),
                    ],
                });
            } else {
                message.channel.sendTyping();
                await message.reply(
                    "You already have an open mail request. Please wait until our team responds to you."
                );
            }
        } else {
            message.channel.sendTyping();
            mails.push({
                id: mails.length == 0 ? 1 : mails[mails.length - 1].id + 1,
                from: message.author.id,
                subject: message.content,
                status: 0,
                date: Math.floor(Date.now() / 1000),
                takenBy: null,
            });
            fs.writeFileSync(
                path.resolve(__dirname + mailsPath),
                JSON.stringify(mails)
            );
            await message.reply(
                "Your message has been received. Our team will get back to you as soon as possible."
            );
        }
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (
            !interaction.options.get("ephemeral") ||
            interaction.options.get("ephemeral")?.value == true
        ) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }
    }

    switch (interaction.commandName) {
        case "close":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname + wlPath))
            );
            var mails = JSON.parse(
                fs.readFileSync(path.resolve(__dirname + mailsPath))
            );

            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "You have no permissions to run this command."
                            )
                            .setColor(0xf00),
                    ],
                });
            } else {
                var mail = mails.filter(
                    (m) => m.takenBy == interaction.user.id
                );
                if (mail.length == 0) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("You have no taken mails.")
                                .setColor(0xf00),
                        ],
                    });
                } else {
                    var user = await client.users.fetch(mail[0].from);
                    mails.splice(mails.indexOf(mail[0]), 1);
                    fs.writeFileSync(
                        path.resolve(__dirname + mailsPath),
                        JSON.stringify(mails)
                    );
                    user.send(
                        `Your mail (ID: ${mail[0].id}) has been closed by <@${interaction.user.id}>. If you have further questions, feel free to open a new mail.`
                    );
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Successfully closed the mail.")
                                .setColor(0x00ff00),
                        ],
                    });
                }
            }
        case "respond":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname + wlPath))
            );
            var mails = JSON.parse(
                fs.readFileSync(path.resolve(__dirname + mailsPath))
            );
            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "You have no permissions to run this command."
                            )
                            .setColor(0xf00),
                    ],
                });
            } else if (
                mails.filter((m) => m.id == interaction.options.get("id").value)
                    .length == 0
            ) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Mail ID you entered has not found.")
                            .setColor(0xf00),
                    ],
                });
            } else {
                var id = interaction.options.get("id").value;
                var mail = mails.filter((m) => m.id == id)[0];
                var user = await client.users.fetch(mail.from);
                mails[mails.indexOf(mail)].takenBy = interaction.user.id;
                fs.writeFileSync(
                    path.resolve(__dirname + mailsPath),
                    JSON.stringify(mails)
                );
                user.send(
                    `Your mail (ID: ${mail.id}) has been taken by <@${interaction.user.id}>. Please, wait for response.`
                );
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Successfully responded to mail.")
                            .setColor(0x00ff00),
                    ],
                });
            }
            break;
        case "mails":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname + wlPath))
            );
            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "You have no permissions to run this command."
                            )
                            .setColor(0xf00),
                    ],
                });
            } else {
                var mails = JSON.parse(
                    fs.readFileSync(path.resolve(__dirname + mailsPath))
                );

                mails = mails.filter((mail) => mail.takenBy == null);

                if (mails.length == 0) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("There are no available mails.")
                                .setColor(0x00ff00),
                        ],
                    });
                }

                var mailChunks = [];
                var chunkSize = 10;
                for (var i = 0; i < Object.keys(mails).length; i += chunkSize) {
                    mailChunks.push(Object.keys(mails).slice(i, i + chunkSize));
                }

                let currentPage = 0;

                const embeds = mailChunks.map((chunk, index) => {
                    let embed = new EmbedBuilder()
                        .setTitle(
                            `Mails (Page ${index + 1}/${mailChunks.length})`
                        )
                        .setColor(0x00ff00);
                    chunk.forEach((mailId) => {
                        embed.addFields({
                            name: `Mail ID: ${mails[mailId].id}`,
                            value: `From: <@${mails[mailId].from}>\nSubject: ${
                                mails[mailId].subject.length > 35
                                    ? mails[mailId].subject.slice(0, 33) + "..."
                                    : mails[mailId].subject
                            }\nDate: <t:${mails[mailId].date}:R>`,
                        });
                    });
                    return embed;
                });

                function updateRow() {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("prev")
                            .setLabel("< Previous")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage == 0 ? true : false),
                        new ButtonBuilder()
                            .setCustomId("page_info")
                            .setLabel(
                                `Page ${currentPage + 1} of ${
                                    mailChunks.length
                                }`
                            )
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("next")
                            .setLabel("Next >")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(
                                mailChunks.length - 1 == currentPage
                                    ? true
                                    : false
                            )
                    );
                }

                await interaction.editReply({
                    embeds: [embeds[0]],
                    components: [updateRow()],
                });

                const message = await interaction.fetchReply();
                message
                    .createMessageComponentCollector({ time: 600000 })
                    .on("collect", async (btnInt) => {
                        if (btnInt.user.id !== interaction.user.id) {
                            return btnInt.reply({
                                content: "These buttons aren't for you!",
                                ephemeral: true,
                            });
                        }
                        if (btnInt.customId === "next") {
                            currentPage++;
                        } else if (btnInt.customId === "prev") {
                            currentPage--;
                        }
                        await btnInt.update({
                            embeds: [embeds[currentPage]],
                            components: [updateRow()],
                        });
                    });
            }
            break;
        case "whitelist_add":
            let start = fs.readFileSync(
                path.resolve(__dirname + wlPath),
                "utf-8"
            );
            try {
                start = JSON.parse(start);
                var isStop = false;
                start.forEach((e) => {
                    if (e == interaction.options.get("user").value) {
                        interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(
                                        "This user is already in whitelist"
                                    )
                                    .setColor(0xff0000),
                            ],
                        });
                        isStop = true;
                    }
                });
                if (isStop) break;
                let end = [interaction.options.get("user").value, ...start];
                fs.writeFile(
                    path.resolve(__dirname + wlPath),
                    JSON.stringify(end),
                    (err) => {
                        if (err) throw err;
                        interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("User added")
                                    .setColor(0x00ff00),
                            ],
                        });
                    }
                );
            } catch (e) {
                throw new Error(e);
            }
            break;
        case "whitelist_remove":
            let startt = fs.readFileSync(
                path.resolve(__dirname + wlPath),
                "utf-8"
            );
            try {
                startt = JSON.parse(startt);
                if (
                    startt.indexOf(interaction.options.get("user").value) == -1
                ) {
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("This user is not in whitelist")
                                .setColor(0xff0000),
                        ],
                    });
                    break;
                }

                startt.splice(
                    startt.indexOf(interaction.options.get("user").value),
                    1
                );
                fs.writeFile(
                    path.resolve(__dirname + wlPath),
                    JSON.stringify(startt),
                    (err) => {
                        if (err) throw err;
                        interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("User removed")
                                    .setColor(0x00ff00),
                            ],
                        });
                    }
                );
            } catch (e) {
                throw new Error(e);
            }
            break;
    }
});
