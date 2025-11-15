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
    StringSelectMenuBuilder,
} = require("discord.js");
const client = new Client({
    intents: [
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});
const fs = require("fs");
const path = require("path");
const [wlPath, mailsPath] = ["/data/whitelist.json", "/data/mails.json"];

const dotenv = require("dotenv").config({
    path: process.argv[3] == "dev" ? ".env.development" : ".env",
});
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { TOKEN, CLIENT_ID } = process.env;

const rest = new REST({ version: "10" }).setToken(TOKEN);

const commands = [
    new SlashCommandBuilder().setName("mails").setDescription("Get all mails"),
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
];

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

client.on(Events.InteractionCreate, async (interaction) => {
    switch (interaction.commandName) {
        case "mails":
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
                                mails[mailId].subject
                            }\nDate: ${new Date(
                                mails[mailId].date
                            ).toLocaleString()}`,
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
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });
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
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
