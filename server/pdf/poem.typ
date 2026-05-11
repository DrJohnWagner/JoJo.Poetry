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

{% if analytics_primary or analytics_secondary %}
#pagebreak()

#heading(level: 1)[Visual Analytics]

{% if analytics_primary %}
{% set first_primary = analytics_primary[0] %}
#block(breakable: false)[
    #heading(level: 2)[Primary Visualisation]
    #text(weight: "semibold")[{{ first_primary.title }}]
    {% if first_primary.summary %}
    #v(0.3em)
    {{ first_primary.summary }}
    {% endif %}
    #v(0.5em)
    #image("{{ first_primary.image_path }}", width: 100%)
]

{% if analytics_primary|length > 1 %}
#v(1.0em)
{% endif %}

{% for item in analytics_primary[1:] %}
#block(breakable: false)[
    #text(weight: "semibold")[{{ item.title }}]
    {% if item.summary %}
    #v(0.3em)
    {{ item.summary }}
    {% endif %}
    #v(0.5em)
    #image("{{ item.image_path }}", width: 100%)
]

{% if not loop.last %}
#v(1.0em)
{% endif %}
{% endfor %}
{% endif %}

{% if analytics_secondary %}
#heading(level: 2)[Secondary and Supplemental]

{% for pair in analytics_secondary|batch(2, none) %}
#grid(columns: (1fr, 1fr), gutter: 1.2cm,
    [
        #block(breakable: false)[
            #text(weight: "semibold")[{{ pair[0].title }}]
            {% if pair[0].summary %}
            #v(0.3em)
            {{ pair[0].summary }}
            {% endif %}
            #v(0.5em)
            #image("{{ pair[0].image_path }}", width: 100%)
        ]
    ],
    [
        {% if pair[1] %}
        #block(breakable: false)[
            #text(weight: "semibold")[{{ pair[1].title }}]
            {% if pair[1].summary %}
            #v(0.3em)
            {{ pair[1].summary }}
            {% endif %}
            #v(0.5em)
            #image("{{ pair[1].image_path }}", width: 100%)
        ]
        {% endif %}
    ],
)
{% if not loop.last %}
#v(0.8em)
{% endif %}
{% endfor %}
{% endif %}
{% endif %}