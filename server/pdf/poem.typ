#set page(
    paper: "{{ paper }}",
    margin: {{ margin }},
)

#set text(
    font: "{{ font }}",
    weight: "{{ weight }}",
    style: "{{ style }}",
    size: {{ font_size }},
    fill: rgb("{{ colour }}"),
)

#set par(leading: {{ leading }}em, spacing: {{ spacing }}em)

#align(center)[
    #text(size: {{ title_font_size }})[{{ title }}]
    #v(0.3em)
    By {{ author }}
]

#v(1.5em)

{% if columns == 1 %}
#align(center)[
    #block[
        #align(left)[
{% for stanza in stanzas %}
            #block(breakable: false)[
{{ stanza }}
            ]
{% endfor %}
        ]
    ]
]
{% else %}
#columns(
    {{ columns }},
    gutter: {{ gutter }},
)[
{% for stanza in stanzas %}
    #block(breakable: false)[
{{ stanza }}
    ]
{% endfor %}
]
{% endif %}