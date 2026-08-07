package com.dimscm.moneyprinter.data.remote

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MoneyPrinterApi {

    @POST("api/v1/videos")
    suspend fun createVideo(@Body request: TaskVideoRequest): TaskCreateEnvelope

    @GET("api/v1/tasks")
    suspend fun listTasks(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
    ): TaskListEnvelope

    @GET("api/v1/tasks/{taskId}")
    suspend fun getTask(@Path("taskId") taskId: String): TaskStatusEnvelope

    @DELETE("api/v1/tasks/{taskId}")
    suspend fun deleteTask(@Path("taskId") taskId: String): SimpleEnvelope

    @GET("api/v1/musics")
    suspend fun listMusics(): BgmListEnvelope

    @POST("api/v1/scripts")
    suspend fun generateScript(@Body request: VideoScriptRequest): VideoScriptEnvelope

    @POST("api/v1/terms")
    suspend fun generateTerms(@Body request: VideoTermsRequest): VideoTermsEnvelope
}
