const {
    proto,
    downloadContentFromMessage,
    getContentType
} = require('@whiskeysockets/baileys')

const fs = require('fs')

const downloadMediaMessage = async (m, filename) => {
    try {
        if (m.type === 'viewOnceMessage') m.type = m.msg.type

        let mediaType = ''
        let ext = 'bin'

        if (m.type === 'imageMessage') {
            mediaType = 'image'
            ext = 'jpg'
        } else if (m.type === 'videoMessage') {
            mediaType = 'video'
            ext = 'mp4'
        } else if (m.type === 'audioMessage') {
            mediaType = 'audio'
            ext = 'mp3'
        } else if (m.type === 'stickerMessage') {
            mediaType = 'sticker'
            ext = 'webp'
        } else if (m.type === 'documentMessage') {
            mediaType = 'document'
            ext = m.msg.fileName?.split('.').pop()?.toLowerCase() || 'bin'
        } else {
            return null
        }

        const stream = await downloadContentFromMessage(m.msg, mediaType)
        let buffer = Buffer.from([])

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        if (filename) {
            const save = `${filename}.${ext}`
            fs.writeFileSync(save, buffer)
            return save
        }

        return buffer
    } catch (e) {
        console.log('Download Error:', e)
        return null
    }
}

const sms = (conn, m) => {
    if (!m) return m

    if (m.key) {
        m.id = m.key.id
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')

        m.sender = m.fromMe
            ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
            : m.isGroup
            ? m.key.participant
            : m.chat
    }

    if (m.message) {
        m.type = getContentType(m.message)

        m.msg =
            m.type === 'viewOnceMessage'
                ? m.message[m.type].message[
                      getContentType(m.message[m.type].message)
                  ]
                : m.message[m.type]

        if (m.msg) {
            if (m.type === 'viewOnceMessage') {
                m.msg.type = getContentType(m.message[m.type].message)
            }

            const quotedMention =
                m.msg.contextInfo?.participant || ''

            const tagMention =
                m.msg.contextInfo?.mentionedJid || []

            const mention =
                typeof tagMention === 'string'
                    ? [tagMention]
                    : tagMention

            mention.push(quotedMention)

            m.mentionUser = mention.filter(v => v)

            m.body =
                m.type === 'conversation'
                    ? m.msg
                    : m.type === 'extendedTextMessage'
                    ? m.msg.text
                    : m.type === 'imageMessage'
                    ? m.msg.caption
                    : m.type === 'videoMessage'
                    ? m.msg.caption
                    : m.type === 'buttonsResponseMessage'
                    ? m.msg.selectedButtonId
                    : m.type === 'templateButtonReplyMessage'
                    ? m.msg.selectedId
                    : ''

            m.quoted = m.msg.contextInfo?.quotedMessage || null

            if (m.quoted) {
                m.quoted.type = getContentType(m.quoted)
                m.quoted.id = m.msg.contextInfo.stanzaId
                m.quoted.sender = m.msg.contextInfo.participant

                m.quoted.fromMe = m.quoted.sender.includes(
                    conn.user.id.split(':')[0]
                )

                m.quoted.msg =
                    m.quoted.type === 'viewOnceMessage'
                        ? m.quoted[m.quoted.type].message[
                              getContentType(
                                  m.quoted[m.quoted.type].message
                              )
                          ]
                        : m.quoted[m.quoted.type]

                m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
                    key: {
                        remoteJid: m.chat,
                        fromMe: m.quoted.fromMe,
                        id: m.quoted.id,
                        participant: m.quoted.sender
                    },
                    message: m.quoted
                })

                m.quoted.delete = () =>
                    conn.sendMessage(m.chat, {
                        delete: m.quoted.fakeObj.key
                    })

                m.quoted.react = (emoji) =>
                    conn.sendMessage(m.chat, {
                        react: {
                            text: emoji,
                            key: m.quoted.fakeObj.key
                        }
                    })

                m.quoted.download = (file) =>
                    downloadMediaMessage(m.quoted, file)
            }
        }

        m.download = (file) => downloadMediaMessage(m, file)
    }

    m.reply = (text, jid = m.chat, opt = {}) =>
        conn.sendMessage(
            jid,
            {
                text: String(text),
                ...opt
            },
            { quoted: m }
        )

    m.replyImg = (img, text = '', jid = m.chat) =>
        conn.sendMessage(
            jid,
            {
                image:
                    typeof img === 'string'
                        ? { url: img }
                        : img,
                caption: text
            },
            { quoted: m }
        )

    m.replyVid = (vid, text = '', jid = m.chat, gif = false) =>
        conn.sendMessage(
            jid,
            {
                video:
                    typeof vid === 'string'
                        ? { url: vid }
                        : vid,
                caption: text,
                gifPlayback: gif
            },
            { quoted: m }
        )

    m.replyAud = (aud, jid = m.chat, ptt = false) =>
        conn.sendMessage(
            jid,
            {
                audio:
                    typeof aud === 'string'
                        ? { url: aud }
                        : aud,
                ptt,
                mimetype: 'audio/mpeg'
            },
            { quoted: m }
        )

    m.replyDoc = (
        doc,
        jid = m.chat,
        fileName = 'file.pdf',
        mimetype = 'application/pdf'
    ) =>
        conn.sendMessage(
            jid,
            {
                document:
                    typeof doc === 'string'
                        ? { url: doc }
                        : doc,
                fileName,
                mimetype
            },
            { quoted: m }
        )

    m.react = (emoji) =>
        conn.sendMessage(m.chat, {
            react: {
                text: emoji,
                key: m.key
            }
        })

    return m
}

module.exports = {
    sms,
    downloadMediaMessage
    }
