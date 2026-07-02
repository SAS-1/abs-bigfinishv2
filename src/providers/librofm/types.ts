export type JsonLdContext = string | string[] | Record<string, unknown>

export interface JsonLdThing {
	'@context'?: JsonLdContext
	'@type'?: string | string[]
	'@id'?: string
	description?: string
	image?: string | JsonLdImageObject
	name?: string
    sameAs?: string | string[]
	url?: string
}

export interface JsonLdPerson extends JsonLdThing {
	'@type'?: 'Person'
	givenName?: string
	familyName?: string
}

export interface JsonLdOrganization extends JsonLdThing {
	'@type'?: 'Organization'
}

export type JsonLdAuthor = JsonLdPerson | JsonLdOrganization

export interface JsonLdPropertyValue extends JsonLdThing {
	'@type'?: 'PropertyValue'
	propertyID?: string
	value?: string | number
}

export interface JsonLdMediaObject extends JsonLdCreativeWork {
    '@type'?: 'MediaObject' | string | string[]
    contentSize?: string
	contentUrl?: string
    duration?: string
	height?: number | string
	width?: number | string
}

export interface JsonLdAudioObject extends JsonLdMediaObject {
    '@type'?: 'AudioObject' | string | string[]
    caption?: string
    transcript?: string
}

export interface JsonLdImageObject extends JsonLdMediaObject {
	'@type'?: 'ImageObject'
    caption?: string
}

export interface JsonLdOffer extends JsonLdThing {
	'@type'?: 'Offer'
	availability?: string
	category?: string | JsonLdThing | Array<string | JsonLdThing>
	eligibleRegion?: string | JsonLdThing | Array<string | JsonLdThing>
	price?: number | string
	priceCurrency?: string
}

export interface JsonLdAggregateRating extends JsonLdRating {
	'@type'?: 'AggregateRating'
    itemReviewed?: JsonLdThing
	ratingCount?: number
	reviewCount?: number
}

export interface JsonLdRating extends JsonLdThing {
	'@type'?: 'Rating' | string | string[]
	author?: JsonLdAuthor | string
    bestRating?: number | string
    ratingExplanation?: string
    ratingValue?: number | string
    reviewAspect?: string | JsonLdThing
    worstRating?: number | string
}

export interface JsonLdCreativeWork extends JsonLdThing {
	'@type'?: 'CreativeWork' | string | string[]
    about?: JsonLdThing | JsonLdThing[] | string
    abstract?: string
	author?: JsonLdAuthor | JsonLdAuthor[] | string
	datePublished?: string
	genre?: string | string[]
    hasPart?: JsonLdCreativeWork | JsonLdCreativeWork[]
	inLanguage?: string
	isPartOf?: JsonLdCreativeWork | string | Array<JsonLdCreativeWork | string>
    keywords?: string | string[]
	offers?: JsonLdOffer | JsonLdOffer[]
	publisher?: JsonLdOrganization | JsonLdPerson
    text?: string
    translator?: JsonLdPerson | JsonLdOrganization | Array<JsonLdPerson | JsonLdOrganization>
}

export interface JsonLdBook extends JsonLdCreativeWork {
	'@type'?: 'Book' | string | string[]
	abridged?: boolean
	bookEdition?: string
    bookFormat?: 'AudiobookFormat' | 'EBook' | 'GraphicNovel' | 'Hardcover' | 'Pamphlet' | 'Paperback'
	illustrator?: JsonLdPerson | JsonLdPerson[] | string
    isbn?: string | string[]
	numberOfPages?: number
}

export interface JsonLdAudiobook extends JsonLdBook, JsonLdAudioObject {
	'@type'?: 'Audiobook'
	readBy?: JsonLdPerson | JsonLdPerson[] | string
    bookFormat?: 'AudiobookFormat'
}
