package pl.fiszki

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SetSummary(
    val id: Int,
    val slug: String,
    val label: String,
    val category: String? = null,
    val cardCount: Int,
)

@Serializable
data class SetDetail(
    val id: Int,
    val slug: String,
    val label: String,
    val category: String? = null,
    val cards: List<Card> = emptyList(),
)

@Serializable
data class Card(
    val id: Int,
    val position: Int = 0,
    val front: String = "",
    val back: String = "",
    val symbols: String? = null,
    val matching: Matching? = null,
    val frontImage: String? = null,
    val backImage: String? = null,
)

/** Karta „dopasuj pary" — w tym wydaniu pokazywana jako lista par, bez interakcji. */
@Serializable
data class Matching(
    val pairs: List<List<String>> = emptyList(),
)

@Serializable
data class User(val id: Int, val email: String)

@Serializable
data class AuthResult(val token: String, val user: User)

@Serializable
data class RequestCodeBody(val email: String)

@Serializable
data class VerifyBody(val email: String, val code: String)

@Serializable
data class CardOrderBody(val cardIds: List<Int>)

@Serializable
data class ApiDetail(@SerialName("detail") val detail: String? = null)
