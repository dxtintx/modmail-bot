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
    DMChannel,
    SlashCommandSubcommandBuilder,
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
let phrase;
const fs = require("fs");
const path = require("path");
const [wlPath, mailsPath] = ["./data/whitelist.json", "./data/mails.json"];
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
        .setName("how-to-use")
        .setDescription("How to use the modmail bot"),
    new SlashCommandBuilder()
        .setName("whitelist")
        .setDescription("Manage whitelist commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("add")
                .setDescription(
                    "Add user to whitelist and making him able to have access to this server's mail"
                )
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("remove")
                .setDescription(
                    "Remove user from whitelist and making him not able to have access to this server's mail"
                )
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("list")
                .setDescription("Get all whitelisted users in this server")
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
    new SlashCommandBuilder()
        .setName("logs")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Get logs for a mail")
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("export")
                .setDescription("Export logs for a mail")
                .addNumberOption(
                    new SlashCommandNumberOption()
                        .setRequired(true)
                        .setName("id")
                        .setDescription("Mail ID")
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("info")
                .setDescription("Get info about a mail")
                .addNumberOption(
                    new SlashCommandNumberOption()
                        .setRequired(true)
                        .setName("id")
                        .setDescription("Mail ID")
                )
        ),
];

if (!fs.existsSync(path.resolve(__dirname, "./data"))) {
    fs.mkdir(path.resolve(__dirname, "./data"), (err) => {
        if (err) throw err;
    });
}
if (!fs.existsSync(path.resolve(__dirname, "./logs"))) {
    fs.mkdir(path.resolve(__dirname, "./logs"), (err) => {
        if (err) throw err;
    });
}
if (!fs.existsSync(path.resolve(__dirname, wlPath))) {
    console.log("Whitelist file not found, creating...");
    fs.writeFileSync(path.resolve(__dirname, wlPath), "[]");
}
if (!fs.existsSync(path.resolve(__dirname, mailsPath))) {
    console.log("Mails file not found, creating...");
    fs.writeFileSync(path.resolve(__dirname, mailsPath), "[]");
}

function getStatus(code) {
    switch (code) {
        case 0:
            return phrase.STATUS_OPEN;
        case 1:
            return phrase.STATUS_PENDING;
        default:
            return phrase.STATUS_UNKNOWN;
    }
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

function compareStrings(blank, ...strings) {
    var res = blank;
    for (let i = 0; i <= strings.length; i++) {
        res = res.replace("%s", strings[i]);
    }
    return res;
}

const logTools = {
    convertContent: (user, content) => {
        const date = new Date().toLocaleTimeString();
        const prefixBase = `[${date}] ${user.tag} >`;
        const pad = " ".repeat(prefixBase.length + 1);

        const lines = content
            .split("\n")
            .filter((line) => line.trim().length > 0);

        const formattedLines = lines.map((line, index) => {
            const start = index === 0 ? prefixBase + " " : pad;
            const wrapRegex = new RegExp(
                `(?![^\\n]{1,${50}}$)([^\\n]{1,${50}})\\s`,
                "g"
            );

            const wrappedLine = line.replace(wrapRegex, `$1\n${pad}`);

            return start + wrappedLine;
        });

        return formattedLines.join("\n");
    },
    writeLog: (mailId, date, content) => {
        fs.appendFileSync(
            path.resolve(__dirname, "./logs/" + mailId + "-" + date + ".txt"),
            "\n" + content
        );
    },
};

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !(message.channel instanceof DMChannel)) return;
    var mails = JSON.parse(fs.readFileSync(path.resolve(__dirname, mailsPath)));
    var whitelist = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, wlPath))
    );
    if (whitelist.indexOf(message.author.id) != -1) {
        var mail = mails.filter((m) => m.takenBy == message.author.id);
        if (mail.length > 0 && mail[0].from) {
            var user = await client.users.fetch(mail[0].from);
            logTools.writeLog(
                mail[0].id,
                mail[0].date,
                logTools.convertContent(message.author, message.content)
            );
            return user.send({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(message.content)
                        .setAuthor({
                            name: compareStrings(
                                phrase.RESPONSE_FROM,
                                message.author.tag
                            ),
                            iconURL: message.author.displayAvatarURL(),
                        })
                        .setColor(0x0f0)
                        .setTimestamp(),
                ],
            });
        } else {
            message.channel.sendTyping();
            return await message.reply(compareStrings(phrase.NO_TAKEN_MAILS));
        }
    } else {
        if (mails.filter((m) => m.from == message.author.id).length > 0) {
            var mail = mails.filter((m) => m.from == message.author.id);
            console.log(mail);
            if (mail[0].takenBy != null) {
                var mod = await client.users.fetch(mail[0].takenBy);
                mod.send({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(message.content)
                            .setAuthor({
                                name: compareStrings(
                                    phrase.RESPONSE_FROM_ID,
                                    message.author.tag,
                                    mail[0].id
                                ),
                                iconURL: message.author.displayAvatarURL(),
                            })
                            .setColor(0x0f0)
                            .setTimestamp(),
                    ],
                });
                logTools.writeLog(
                    mail[0].id,
                    mail[0].date,
                    logTools.convertContent(message.author, message.content)
                );
            } else {
                message.channel.sendTyping();
                await message.reply(phrase.ALREADY_OPEN);
            }
        } else {
            message.channel.sendTyping();
            mails.push({
                id: mails.length == 0 ? 1 : mails[mails.length - 1].id + 1,
                from: message.author.id,
                subject: message.content,
                date: Math.floor(Date.now() / 1000),
                takenBy: null,
            });
            fs.writeFileSync(
                path.resolve(__dirname, mailsPath),
                JSON.stringify(mails)
            );

            fs.writeFileSync(
                path.resolve(
                    __dirname,
                    "./logs/" +
                        (mails.length == 0 ? 1 : mails[mails.length - 1].id) +
                        "-" +
                        Math.floor(Date.now() / 1000) +
                        ".txt"
                ),
                " - Mail opened by " +
                    message.author.tag +
                    " (ID: " +
                    message.author.id +
                    ")\n\n" +
                    logTools.convertContent(message.author, message.content)
            );
            await message.reply(phrase.MESSAGE_RECIEVED);
        }
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    delete require.cache[require.resolve("./config/phrases.json")];
    phrase = require("./config/phrases.json");

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    switch (interaction.commandName) {
        case "close":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, wlPath))
            );
            var mails = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, mailsPath))
            );

            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.NO_PERMISSION)
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
                                .setTitle(phrase.NO_TAKEN_MAILS)
                                .setColor(0xf00),
                        ],
                    });
                } else {
                    var user = await client.users.fetch(mail[0].from);
                    mails[mails.indexOf(mail[0])].takenBy += "-";
                    mails[mails.indexOf(mail[0])].from += "-";

                    fs.writeFileSync(
                        path.resolve(__dirname, mailsPath),
                        JSON.stringify(mails)
                    );
                    user.send(
                        compareStrings(
                            phrase.MAIL_CLOSED,
                            mail[0].id,
                            interaction.user.id
                        )
                    );
                    logTools.writeLog(
                        mail[0].id,
                        mail[0].date,
                        `\n[${new Date().toLocaleTimeString()}] - Closed by ` +
                            interaction.user.tag +
                            " (ID: " +
                            interaction.user.id +
                            "). \n"
                    );
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(phrase.SUCCESS_CLOSE)
                                .setColor(0x0f0),
                        ],
                    });
                }
            }
        case "respond":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, wlPath))
            );
            var mails = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, mailsPath))
            );
            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.NO_PERMISSION)
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
                            .setTitle(
                                compareStrings(
                                    phrase.MAIL_NOT_FOUND,
                                    interaction.options.get("id").value
                                )
                            )
                            .setColor(0xf00),
                    ],
                });
            } else if (
                mails.filter((m) => m.takenBy == interaction.user.id).length > 0
            ) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.ALREADY_TAKEN_ANOTHER)
                            .setColor(0xf00),
                    ],
                });
            } else if (
                mails.filter(
                    (m) => m.id == interaction.options.get("id").value
                )[0].takenBy != null
            ) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.MAIL_ALREADY_TAKEN)
                            .setColor(0xf00),
                    ],
                });
            } else {
                var id = interaction.options.get("id").value;
                var mail = mails.filter((m) => m.id == id)[0];
                console.log(mails);
                console.log(mail);
                var user = await client.users.fetch(mail.from);

                mails[mails.indexOf(mail)].takenBy = interaction.user.id;
                fs.writeFileSync(
                    path.resolve(__dirname, mailsPath),
                    JSON.stringify(mails)
                );
                user.send(
                    compareStrings(
                        phrase.MAIL_TAKEN_BY,
                        mail.id,
                        interaction.user.id
                    )
                );

                logTools.writeLog(
                    mail.id,
                    mail.date,
                    `\n[${new Date().toLocaleTimeString()}] - ` +
                        interaction.user.tag +
                        " (ID: " +
                        interaction.user.id +
                        ") responded. \n"
                );

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.SUCCESS_RESPOND)
                            .setDescription(
                                compareStrings(
                                    phrase.SUCCESS_RESPOND_DESC,
                                    mail.from,
                                    mail.subject
                                )
                            )
                            .setColor(0x0f0),
                    ],
                });
            }
        case "mails":
            var wl = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, wlPath))
            );
            if (wl.indexOf(interaction.user.id) == -1) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(phrase.NO_PERMISSION)
                            .setColor(0xf00),
                    ],
                });
            } else {
                var mails = JSON.parse(
                    fs.readFileSync(path.resolve(__dirname, mailsPath))
                );

                mails = mails.filter(
                    (m) =>
                        m.takenBy == null ||
                        m.takenBy[m.takenBy?.length - 1] != "-"
                );

                if (mails.length == 0) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(phrase.NO_MAILS)
                                .setColor(0x0f0),
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
                            compareStrings(
                                phrase.MAILS_PAGE_TITLE,
                                index + 1,
                                mailChunks.length
                            )
                        )
                        .setColor(0x0f0);
                    chunk.forEach((mailId) => {
                        embed.addFields({
                            name: compareStrings(
                                phrase.MAIL_EMBED_TITLE,
                                mails[mailId].id,
                                mails[mailId].takenBy == null
                                    ? getStatus(0)
                                    : getStatus(1)
                            ),
                            value: `${compareStrings(
                                phrase.MAIL_EMBED_FROM,
                                mails[mailId].from
                            )}\n${compareStrings(
                                phrase.MAIL_EMBED_SUBJECT,
                                mails[mailId].subject.length > 35
                                    ? mails[mailId].subject.slice(0, 33) + "..."
                                    : mails[mailId].subject
                            )}\n${compareStrings(
                                phrase.MAIL_EMBED_DATE,
                                mails[mailId].date
                            )}`,
                        });
                    });
                    return embed;
                });

                function updateRow() {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("prev")
                            .setLabel(phrase.PAGINATION_PREV)
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage == 0 ? true : false),
                        new ButtonBuilder()
                            .setCustomId("page_info")
                            .setLabel(
                                compareStrings(
                                    phrase.PAGINATION_CURRENT,
                                    currentPage + 1,
                                    mailChunks.length
                                )
                            )
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("next")
                            .setLabel(phrase.PAGINATION_NEXT)
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
                                content: phrase.NOT_AUTHOR,
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
        case "how-to-use":
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(phrase.HOW_TO_USE_TITLE)
                        .setDescription(phrase.HOW_TO_USE_DESC)
                        .setColor(0x0f0),
                ],
            });
            break;
        case "whitelist":
            switch (interaction.options.getSubcommand()) {
                case "list":
                    if (interaction.channel instanceof DMChannel)
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(phrase.DM_CHANNEL_NOT_ALLOWED)
                                    .setColor(0xf00),
                            ],
                        });
                    let whitelist = fs.readFileSync(
                        path.resolve(__dirname, wlPath),
                        "utf-8"
                    );
                    try {
                        whitelist = JSON.parse(whitelist);
                        if (whitelist.length == 0) {
                            return interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(phrase.WHITELIST_EMPTY)
                                        .setColor(0x0f0),
                                ],
                            });
                        }
                        let desc = "";
                        for (let i = 0; i < whitelist.length; i++) {
                            let user = await client.users.fetch(whitelist[i]);
                            desc += `**${i + 1}.** ${user.tag} (ID: ${
                                whitelist[i]
                            })\n`;
                        }
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(phrase.WHITELIST_USERS)
                                    .setDescription(desc)
                                    .setColor(0x0f0),
                            ],
                        });
                    } catch (e) {
                        throw new Error(e);
                    }
                case "add":
                    if (interaction.channel instanceof DMChannel)
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(phrase.DM_CHANNEL_NOT_ALLOWED)
                                    .setColor(0xf00),
                            ],
                        });

                    let start = fs.readFileSync(
                        path.resolve(__dirname, wlPath),
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
                                                phrase.ALREADY_IN_WHITELIST
                                            )
                                            .setColor(0xff0000),
                                    ],
                                });
                                isStop = true;
                            }
                        });
                        if (isStop) break;
                        let end = [
                            interaction.options.get("user").value,
                            ...start,
                        ];
                        fs.writeFile(
                            path.resolve(__dirname, wlPath),
                            JSON.stringify(end),
                            (err) => {
                                if (err) throw err;
                                interaction.editReply({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setTitle(phrase.ADDED_TO_WHITELIST)
                                            .setColor(0x0f0),
                                    ],
                                });
                            }
                        );
                    } catch (e) {
                        throw new Error(e);
                    }
                    break;
                case "remove":
                    if (interaction.channel instanceof DMChannel)
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(phrase.DM_CHANNEL_NOT_ALLOWED)
                                    .setColor(0xf00),
                            ],
                        });

                    let startt = fs.readFileSync(
                        path.resolve(__dirname, wlPath),
                        "utf-8"
                    );
                    try {
                        startt = JSON.parse(startt);
                        if (
                            startt.indexOf(
                                interaction.options.get("user").value
                            ) == -1
                        ) {
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(phrase.NOT_IN_WHITELIST)
                                        .setColor(0xff0000),
                                ],
                            });
                            break;
                        }

                        startt.splice(
                            startt.indexOf(
                                interaction.options.get("user").value
                            ),
                            1
                        );
                        fs.writeFile(
                            path.resolve(__dirname, wlPath),
                            JSON.stringify(startt),
                            (err) => {
                                if (err) throw err;
                                interaction.editReply({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setTitle(
                                                phrase.REMOVED_FROM_WHITELIST
                                            )
                                            .setColor(0x0f0),
                                    ],
                                });
                            }
                        );
                    } catch (e) {
                        throw new Error(e);
                    }
                    break;
            }
        case "logs":
            switch (interaction.options.getSubcommand()) {
                case "export":
                    var mails = JSON.parse(
                        fs.readFileSync(path.resolve(__dirname, mailsPath))
                    );
                    var mail = mails.filter(
                        (m) => m.id == interaction.options.get("id").value
                    )[0];
                    if (!mail) {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(
                                        compareStrings(
                                            phrase.MAIL_NOT_FOUND,
                                            interaction.options.get("id").value
                                        )
                                    )
                                    .setColor(0xf00),
                            ],
                        });
                    } else {
                        const logFilePath = path.resolve(
                            __dirname,
                            `./logs/${mail.id}-${mail.date}.txt`
                        );
                        if (fs.existsSync(logFilePath)) {
                            await interaction.editReply({
                                files: [logFilePath],
                            });
                        } else {
                            return interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(phrase.LOG_FILE_NOT_FOUND)
                                        .setColor(0xf00),
                                ],
                            });
                        }
                    }
                    break;
                case "info":
                    var mails = JSON.parse(
                        fs.readFileSync(path.resolve(__dirname, mailsPath))
                    );
                    var mail = mails.filter(
                        (m) => m.id == interaction.options.get("id").value
                    )[0];
                    if (!mail) {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(
                                        compareStrings(
                                            phrase.MAIL_NOT_FOUND,
                                            interaction.options.get("id").value
                                        )
                                    )
                                    .setColor(0xf00),
                            ],
                        });
                    } else {
                        const logFilePath = path.resolve(
                            __dirname,
                            `./logs/${mail.id}-${mail.date}.txt`
                        );
                        if (fs.existsSync(logFilePath)) {
                            await interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(
                                            compareStrings(
                                                phrase.LOG_INFO_TITLE,
                                                mail.id
                                            )
                                        )
                                        .setDescription(
                                            phrase.LOG_INFO_SUBJECT +
                                                mail.subject
                                        )
                                        .addFields(
                                            {
                                                name: phrase.LOG_INFO_FROM,
                                                value: `<@${mail.from.replace(
                                                    "-",
                                                    ""
                                                )}>`,
                                                inline: true,
                                            },
                                            {
                                                name: phrase.LOG_INFO_TAKEN_BY,
                                                value: mail.takenBy
                                                    ? `<@${mail.takenBy.replace(
                                                          "-",
                                                          ""
                                                      )}>`
                                                    : phrase.LOG_INFO_NOT_TAKEN,
                                                inline: true,
                                            },
                                            {
                                                name: phrase.LOG_INFO_DATE,
                                                value: `<t:${mail.date}:F>`,
                                                inline: false,
                                            }
                                        )
                                        .setColor(0x0f0),
                                ],
                            });
                        } else {
                            return interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(phrase.LOG_FILE_NOT_FOUND)
                                        .setColor(0xf00),
                                ],
                            });
                        }
                    }
                    break;
                default:
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(phrase.INVALID_ACTION)
                                .setColor(0xf00),
                        ],
                    });
            }
            break;
    }
});
